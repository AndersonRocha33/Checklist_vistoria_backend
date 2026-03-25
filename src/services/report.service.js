const PDFDocument = require('pdfkit');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

function extractBase64Image(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;

  const match = dataUrl.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/);
  if (!match || !match[1]) return null;

  return Buffer.from(match[1], 'base64');
}

function groupItemsByLocation(items) {
  const grouped = {};

  for (const item of items) {
    const location = item.checklistItem.location || 'Sem localização';

    if (!grouped[location]) {
      grouped[location] = [];
    }

    grouped[location].push(item);
  }

  return Object.keys(grouped)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((location) => ({
      location,
      items: grouped[location].sort((a, b) =>
        (a.checklistItem.itemName || '').localeCompare(
          b.checklistItem.itemName || '',
          'pt-BR'
        )
      )
    }));
}

function getInspectionMetrics(items) {
  return {
    total: items.length,
    conforme: items.filter((item) => item.status === 'CONFORME').length,
    naoConforme: items.filter((item) => item.status === 'NAO_CONFORME').length,
    pendente: items.filter((item) => item.status === 'PENDENTE').length
  };
}

function ensurePageSpace(doc, requiredHeight = 120) {
  const usableBottom = doc.page.height - doc.page.margins.bottom;

  if (doc.y + requiredHeight > usableBottom) {
    doc.addPage();
  }
}

function drawHeaderBlock(doc, inspection) {
  const logoPath = path.resolve(__dirname, '../assets/logo.png');
  const hasLogo = fs.existsSync(logoPath);

  if (hasLogo) {
    try {
      doc.image(logoPath, 40, 36, { fit: [110, 50] });
    } catch (error) {
      // segue sem logo
    }
  }

  doc
    .fontSize(22)
    .fillColor('#111827')
    .text('Relatório de Checklist de Entrega', hasLogo ? 170 : 40, 42, {
      width: 360,
      align: 'left'
    });

  doc
    .fontSize(10)
    .fillColor('#6b7280')
    .text('Relatório de vistoria do apartamento decorado', hasLogo ? 170 : 40, 72, {
      width: 360,
      align: 'left'
    });

  doc.roundedRect(40, 110, 515, 88, 12).fillAndStroke('#f8fafc', '#dbeafe');

  doc.fillColor('#111827').fontSize(11);
  doc.text(`Empreendimento: ${inspection.apartment.enterprise.name}`, 55, 126);
  doc.text(`Apartamento: ${inspection.apartment.number}`, 55, 146);
  doc.text(`Responsável: ${inspection.user.name}`, 55, 166);
  doc.text(
    `Data da emissão: ${new Date(inspection.updatedAt).toLocaleString('pt-BR')}`,
    310,
    126
  );
  doc.text(`Status da vistoria: ${inspection.status}`, 310, 146);
  doc.text(`ID da vistoria: ${inspection.id}`, 310, 166);
  doc.fillColor('#111827');
  doc.y = 220;
}

function drawMetricsBlock(doc, metrics) {
  ensurePageSpace(doc, 100);

  const startY = doc.y;
  const boxWidth = 118;
  const gap = 13;
  const startX = 40;

  const cards = [
    { label: 'Total de itens', value: metrics.total, color: '#eff6ff', border: '#bfdbfe' },
    { label: 'Conformes', value: metrics.conforme, color: '#ecfdf5', border: '#bbf7d0' },
    { label: 'Não conformes', value: metrics.naoConforme, color: '#fff7ed', border: '#fdba74' },
    { label: 'Pendentes', value: metrics.pendente, color: '#fefce8', border: '#fde68a' }
  ];

  cards.forEach((card, index) => {
    const x = startX + index * (boxWidth + gap);

    doc.roundedRect(x, startY, boxWidth, 72, 10).fillAndStroke(card.color, card.border);

    doc.fillColor('#6b7280').fontSize(10).text(card.label, x + 10, startY + 12, {
      width: boxWidth - 20,
      align: 'center'
    });

    doc.fillColor('#111827').fontSize(24).text(String(card.value), x + 10, startY + 32, {
      width: boxWidth - 20,
      align: 'center'
    });
  });

  doc.fillColor('#111827');
  doc.y = startY + 86;
}

function getStatusColors(status) {
  if (status === 'CONFORME') {
    return { bg: '#dcfce7', text: '#166534', border: '#86efac' };
  }

  if (status === 'NAO_CONFORME') {
    return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
  }

  return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' };
}

function drawStatusBadge(doc, status, x, y, width = 115) {
  const colors = getStatusColors(status);

  doc.roundedRect(x, y, width, 22, 8).fillAndStroke(colors.bg, colors.border);
  doc.fillColor(colors.text).fontSize(10).text(status, x, y + 6, {
    width,
    align: 'center'
  });
  doc.fillColor('#111827');
}

function drawLocationTitle(doc, location) {
  ensurePageSpace(doc, 50);

  const startY = doc.y;
  doc.roundedRect(40, startY, 515, 28, 8).fill('#e0e7ff');
  doc.fillColor('#1e3a8a').fontSize(13).text(`Localização: ${location}`, 52, startY + 8);
  doc.fillColor('#111827');
  doc.y = startY + 40;
}

function getBaseUrlFromRequest(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol =
    forwardedProto && typeof forwardedProto === 'string'
      ? forwardedProto.split(',')[0]
      : req.protocol;

  return `${protocol}://${req.get('host')}`;
}

function buildAbsolutePhotoUrl(req, photoUrl) {
  if (!photoUrl || typeof photoUrl !== 'string') return null;

  if (photoUrl.startsWith('data:image/')) {
    return photoUrl;
  }

  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
    return photoUrl;
  }

  const normalized = photoUrl.startsWith('/') ? photoUrl : `/${photoUrl}`;
  return `${getBaseUrlFromRequest(req)}${normalized}`;
}

async function getImageBuffer(req, photoUrl) {
  if (!photoUrl || typeof photoUrl !== 'string') {
    return null;
  }

  const base64Buffer = extractBase64Image(photoUrl);
  if (base64Buffer) {
    return base64Buffer;
  }

  const absoluteUrl = buildAbsolutePhotoUrl(req, photoUrl);

  if (absoluteUrl && (absoluteUrl.startsWith('http://') || absoluteUrl.startsWith('https://'))) {
    const response = await axios.get(absoluteUrl, {
      responseType: 'arraybuffer',
      timeout: 15000
    });

    return Buffer.from(response.data);
  }

  const normalizedPath = photoUrl.replace(/\\/g, '/');

  if (
    normalizedPath.startsWith('/uploads/') ||
    normalizedPath.startsWith('uploads/')
  ) {
    const fileName = path.basename(normalizedPath);
    const localPath = path.resolve(__dirname, '../../uploads', fileName);

    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath);
    }
  }

  return null;
}

function getItemSectionHeight(doc, item, hasPhoto) {
  const contentWidth = 345;
  const itemName = item.checklistItem.itemName || '-';
  const notesText = `Observações: ${item.notes || '-'}`;

  doc.fontSize(13);
  const itemNameHeight = doc.heightOfString(itemName, {
    width: contentWidth,
    align: 'left'
  });

  doc.fontSize(11);
  const notesHeight = doc.heightOfString(notesText, {
    width: 470,
    align: 'left'
  });

  const baseHeight = 26 + itemNameHeight + 12 + 18 + 8 + notesHeight + 18;

  if (!hasPhoto) {
    return Math.max(120, baseHeight + 18);
  }

  return Math.max(360, baseHeight + 245);
}

async function drawItemSection(doc, req, item) {
  const hasPhoto = item.status === 'NAO_CONFORME' && item.photoUrl;
  const sectionHeight = getItemSectionHeight(doc, item, hasPhoto);

  ensurePageSpace(doc, sectionHeight + 12);

  const sectionTop = doc.y;
  doc.roundedRect(40, sectionTop, 515, sectionHeight, 10).stroke('#e5e7eb');

  const badgeWidth = 115;
  const badgeX = 425;
  const contentX = 55;
  const contentWidth = 345;
  const itemName = item.checklistItem.itemName || '-';

  doc.fillColor('#111827').fontSize(13).text(itemName, contentX, sectionTop + 14, {
    width: contentWidth,
    align: 'left'
  });

  drawStatusBadge(doc, item.status, badgeX, sectionTop + 14, badgeWidth);

  const itemNameHeight = doc.heightOfString(itemName, {
    width: contentWidth,
    align: 'left'
  });

  const detailY = sectionTop + 18 + itemNameHeight + 14;

  doc.fontSize(11).fillColor('#111827');
  doc.text(`Quantidade: ${item.checklistItem.quantity}`, contentX, detailY);

  const observationsY = detailY + 22;
  const notesText = `Observações: ${item.notes || '-'}`;

  doc.text(notesText, contentX, observationsY, {
    width: 470,
    align: 'left'
  });

  const notesHeight = doc.heightOfString(notesText, {
    width: 470,
    align: 'left'
  });

  if (!hasPhoto) {
    doc.y = sectionTop + sectionHeight + 10;
    return;
  }

  const photoTitleY = observationsY + notesHeight + 16;
  doc.fillColor('#374151').fontSize(11).text(
    'Foto da não conformidade:',
    contentX,
    photoTitleY
  );

  const photoY = photoTitleY + 24;

  try {
    const imageBuffer = await getImageBuffer(req, item.photoUrl);

    if (!imageBuffer) {
      throw new Error('Imagem não encontrada.');
    }

    const photoWidth = 320;
    const photoHeight = 220;
    const photoX = 40 + (515 - photoWidth) / 2;

    doc.image(imageBuffer, photoX, photoY, {
      fit: [photoWidth, photoHeight],
      align: 'center',
      valign: 'center'
    });
  } catch (error) {
    doc.fillColor('#991b1b').fontSize(10).text(
      'Não foi possível carregar a foto deste item.',
      contentX,
      photoY + 10
    );
    doc.fillColor('#111827');
  }

  doc.y = sectionTop + sectionHeight + 10;
}

function drawSignaturesBlock(doc, inspection) {
  ensurePageSpace(doc, 210);

  doc.fontSize(14).fillColor('#111827').text('Assinaturas', 40, doc.y, {
    width: 515,
    align: 'center',
    underline: true
  });

  doc.y += 30;

  const boxWidth = 230;
  const boxHeight = 95;
  const leftX = 40;
  const rightX = 320;
  const titleY = doc.y;
  const boxY = titleY + 18;
  const lineOffset = 108;
  const nameOffset = 116;

  doc.fontSize(12).text('Assinatura do vistoriador:', leftX, titleY, {
    width: boxWidth
  });
  doc.text('Assinatura do cliente:', rightX, titleY, {
    width: boxWidth
  });

  doc.rect(leftX, boxY, boxWidth, boxHeight).stroke();
  doc.rect(rightX, boxY, boxWidth, boxHeight).stroke();

  const inspectorBuffer = extractBase64Image(inspection.inspectorSignature);
  if (inspectorBuffer) {
    try {
      doc.image(inspectorBuffer, leftX + 12, boxY + 10, {
        fit: [boxWidth - 24, boxHeight - 24],
        align: 'center',
        valign: 'center'
      });
    } catch (error) {
      doc.fontSize(10).text('Assinatura inválida', leftX, boxY + 38, {
        width: boxWidth,
        align: 'center'
      });
    }
  } else {
    doc.fontSize(10).text('Não informada', leftX, boxY + 38, {
      width: boxWidth,
      align: 'center'
    });
  }

  const clientBuffer = extractBase64Image(inspection.clientSignature);
  if (clientBuffer) {
    try {
      doc.image(clientBuffer, rightX + 12, boxY + 10, {
        fit: [boxWidth - 24, boxHeight - 24],
        align: 'center',
        valign: 'center'
      });
    } catch (error) {
      doc.fontSize(10).text('Assinatura inválida', rightX, boxY + 38, {
        width: boxWidth,
        align: 'center'
      });
    }
  } else {
    doc.fontSize(10).text('Não informada', rightX, boxY + 38, {
      width: boxWidth,
      align: 'center'
    });
  }

  doc.moveTo(leftX, boxY + lineOffset).lineTo(leftX + boxWidth, boxY + lineOffset).stroke();
  doc.moveTo(rightX, boxY + lineOffset).lineTo(rightX + boxWidth, boxY + lineOffset).stroke();

  doc.fontSize(10).text('Vistoriador', leftX, boxY + nameOffset, {
    width: boxWidth,
    align: 'center'
  });
  doc.text('Cliente', rightX, boxY + nameOffset, {
    width: boxWidth,
    align: 'center'
  });

  doc.y = boxY + 138;
}

class ReportService {
  async generateInspectionReport(req, res, inspection) {
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4'
    });

    const fileName = `vistoria-${inspection.apartment.number}-${inspection.id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    doc.pipe(res);

    drawHeaderBlock(doc, inspection);
    drawMetricsBlock(doc, getInspectionMetrics(inspection.items));

    const groupedLocations = groupItemsByLocation(inspection.items);

    for (const group of groupedLocations) {
      drawLocationTitle(doc, group.location);

      for (const item of group.items) {
        await drawItemSection(doc, req, item);
      }

      doc.y += 4;
    }

    drawSignaturesBlock(doc, inspection);
    doc.end();
  }
}

module.exports = new ReportService();
