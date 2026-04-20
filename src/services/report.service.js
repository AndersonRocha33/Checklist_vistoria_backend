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

function ensurePageSpace(doc, requiredHeight = 40) {
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
      doc.image(logoPath, 40, 32, { fit: [90, 42] });
    } catch (error) {
      console.error('Erro ao carregar logo do relatório:', error.message);
    }
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor('#111111')
    .text('Relatório de Checklist de Entrega', hasLogo ? 150 : 40, 38, {
      width: 360,
      align: 'left'
    });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#666666')
    .text('Relatório de vistoria do apartamento decorado', hasLogo ? 150 : 40, 62, {
      width: 360,
      align: 'left'
    });

  doc
    .lineWidth(0.8)
    .roundedRect(40, 92, 515, 72, 8)
    .stroke('#d9d9d9');

  doc.font('Helvetica').fontSize(10).fillColor('#111111');
  doc.text(`Empreendimento: ${inspection.apartment.enterprise.name}`, 52, 108);
  doc.text(`Apartamento: ${inspection.apartment.number}`, 52, 126);
  doc.text(`Responsável: ${inspection.user.name}`, 52, 144);

  doc.text(
    `Data da emissão: ${new Date(inspection.updatedAt).toLocaleString('pt-BR')}`,
    300,
    108
  );
  doc.text(`Status da vistoria: ${inspection.status}`, 300, 126);
  doc.text(`ID da vistoria: ${inspection.id}`, 300, 144);

  doc.y = 180;
}

function drawMetricsBlock(doc, metrics) {
  ensurePageSpace(doc, 64);

  const startY = doc.y;
  const boxWidth = 118;
  const gap = 13;
  const startX = 40;

  const cards = [
    { label: 'Total de itens', value: metrics.total },
    { label: 'Conformes', value: metrics.conforme },
    { label: 'Não conformes', value: metrics.naoConforme },
    { label: 'Pendentes', value: metrics.pendente }
  ];

  cards.forEach((card, index) => {
    const x = startX + index * (boxWidth + gap);

    doc
      .lineWidth(0.8)
      .roundedRect(x, startY, boxWidth, 48, 8)
      .stroke('#d9d9d9');

    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#666666')
      .text(card.label, x + 8, startY + 8, {
        width: boxWidth - 16,
        align: 'center'
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#111111')
      .text(String(card.value), x + 8, startY + 22, {
        width: boxWidth - 16,
        align: 'center'
      });
  });

  doc.y = startY + 58;
}

function drawLocationTitle(doc, location) {
  ensurePageSpace(doc, 24);

  const startY = doc.y;

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#222222')
    .text(`Localização: ${location}`, 40, startY);

  doc
    .moveTo(40, startY + 16)
    .lineTo(555, startY + 16)
    .lineWidth(0.8)
    .stroke('#d9d9d9');

  doc.y = startY + 22;
}

function getStatusTextStyle(status) {
  if (status === 'CONFORME') {
    return { color: '#1f6f43', label: 'CONFORME' };
  }

  if (status === 'NAO_CONFORME') {
    return { color: '#a61b1b', label: 'NAO_CONFORME' };
  }

  return { color: '#8a6d1f', label: 'PENDENTE' };
}

function drawTableHeader(doc) {
  const startX = 40;
  const startY = doc.y;
  const itemColWidth = 385;
  const qtyColWidth = 45;
  const statusColWidth = 85;
  const headerHeight = 18;

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#444444');
  doc.text('ITEM', startX + 8, startY + 5, {
    width: itemColWidth - 12
  });

  doc.text('QTDE', startX + itemColWidth, startY + 5, {
    width: qtyColWidth,
    align: 'center'
  });

  doc.text('STATUS', startX + itemColWidth + qtyColWidth, startY + 5, {
    width: statusColWidth,
    align: 'center'
  });

  doc
    .moveTo(startX, startY + headerHeight)
    .lineTo(555, startY + headerHeight)
    .lineWidth(0.8)
    .stroke('#d9d9d9');

  doc.font('Helvetica').fillColor('#111111');
  doc.y = startY + headerHeight + 2;
}

function getRowHeight(doc, itemName, width) {
  doc.font('Helvetica').fontSize(8.5);
  const textHeight = doc.heightOfString(itemName || '-', {
    width,
    align: 'left'
  });

  return Math.max(16, textHeight + 4);
}

function normalizePhotoUrl(photoUrl) {
  if (!photoUrl || typeof photoUrl !== 'string') return null;

  let normalized = photoUrl.trim();

  if (normalized.startsWith('http://')) {
    normalized = normalized.replace(/^http:\/\//i, 'https://');
  }

  return normalized;
}

async function getImageBuffer(photoUrl) {
  if (!photoUrl || typeof photoUrl !== 'string') {
    return null;
  }

  const normalizedUrl = normalizePhotoUrl(photoUrl);

  const base64Buffer = extractBase64Image(normalizedUrl);
  if (base64Buffer) {
    return base64Buffer;
  }

  if (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) {
    const response = await axios.get(normalizedUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 300
    });

    return Buffer.from(response.data);
  }

  const normalizedPath = normalizedUrl.replace(/\\/g, '/');

  if (normalizedPath.startsWith('/uploads/') || normalizedPath.startsWith('uploads/')) {
    const fileName = path.basename(normalizedPath);
    const localPath = path.resolve(__dirname, '../../uploads', fileName);

    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath);
    }
  }

  return null;
}

function getInlineNonConformHeight(doc, item, hasPhoto) {
  const notesText = `Observações: ${item.notes || '-'}`;

  doc.font('Helvetica').fontSize(9.2);
  const notesHeight = doc.heightOfString(notesText, {
    width: 455
  });

  const baseHeight = 16 + 14 + 6 + notesHeight + 10;

  if (!hasPhoto) {
    return Math.max(44, baseHeight);
  }

  return Math.max(170, baseHeight + 120);
}

async function drawInlineNonConformDetails(doc, item) {
  const startX = 58;
  const width = 480;
  const hasPhoto = Boolean(item.photoUrl);
  const blockHeight = getInlineNonConformHeight(doc, item, hasPhoto);

  ensurePageSpace(doc, blockHeight + 4);

  const startY = doc.y;

  doc
    .lineWidth(0.6)
    .roundedRect(startX, startY, width, blockHeight, 6)
    .stroke('#e4e4e4');

  let currentY = startY + 10;

  doc.font('Helvetica').fontSize(9.2).fillColor('#111111');
  doc.text(`Quantidade: ${item.checklistItem.quantity}`, startX + 10, currentY);

  currentY += 16;

  const notesText = `Observações: ${item.notes || '-'}`;
  doc.text(notesText, startX + 10, currentY, {
    width: width - 20
  });

  const notesHeight = doc.heightOfString(notesText, {
    width: width - 20
  });

  currentY += notesHeight + 8;

  if (hasPhoto) {
    doc.font('Helvetica').fontSize(9).fillColor('#444444');
    doc.text('Foto da não conformidade:', startX + 10, currentY);

    currentY += 14;

    try {
      const imageBuffer = await getImageBuffer(item.photoUrl);

      if (!imageBuffer) {
        throw new Error('Imagem não encontrada ou vazia.');
      }

      const photoWidth = 180;
      const photoHeight = 100;
      const photoX = startX + (width - photoWidth) / 2;

      doc.image(imageBuffer, photoX, currentY, {
        fit: [photoWidth, photoHeight],
        align: 'center',
        valign: 'center'
      });
    } catch (error) {
      console.error('Erro ao carregar imagem no relatório:', error.message);
      console.error('URL da imagem:', item.photoUrl);

      doc.font('Helvetica').fillColor('#a61b1b').fontSize(8.5).text(
        'Não foi possível carregar a foto deste item.',
        startX + 10,
        currentY + 4
      );
      doc.fillColor('#111111');
    }
  }

  doc.y = startY + blockHeight + 4;
}

async function drawLocationSection(doc, group) {
  drawLocationTitle(doc, group.location);
  drawTableHeader(doc);

  const startX = 40;
  const itemColWidth = 385;
  const qtyColWidth = 45;
  const statusColWidth = 85;

  for (const item of group.items) {
    const itemName = item.checklistItem.itemName || '-';
    const rowHeight = getRowHeight(doc, itemName, itemColWidth - 16);
    const isNonConform = item.status === 'NAO_CONFORME';
    const detailsHeight = isNonConform
      ? getInlineNonConformHeight(doc, item, Boolean(item.photoUrl)) + 4
      : 0;

    const minSpace = rowHeight + detailsHeight + 4;

    ensurePageSpace(doc, minSpace);

    if (doc.y + minSpace > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawLocationTitle(doc, group.location);
      drawTableHeader(doc);
    }

    const y = doc.y;
    const statusStyle = getStatusTextStyle(item.status);

    doc
      .moveTo(startX, y - 2)
      .lineTo(555, y - 2)
      .lineWidth(0.5)
      .stroke('#efefef');

    doc.font('Helvetica').fontSize(8.5).fillColor('#111111');
    doc.text(itemName, startX + 8, y + 1, {
      width: itemColWidth - 16
    });

    doc.text(String(item.checklistItem.quantity || 0), startX + itemColWidth, y + 1, {
      width: qtyColWidth,
      align: 'center'
    });

    doc.font('Helvetica-Bold').fillColor(statusStyle.color).text(
      statusStyle.label,
      startX + itemColWidth + qtyColWidth,
      y + 1,
      {
        width: statusColWidth,
        align: 'center'
      }
    );

    doc.fillColor('#111111');
    doc.y = y + rowHeight;

    if (isNonConform) {
      await drawInlineNonConformDetails(doc, item);
    }
  }

  doc.y += 6;
}

function drawSignaturesBlock(doc, inspection) {
  ensurePageSpace(doc, 145);

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#111111')
    .text('Assinaturas', 40, doc.y, {
      width: 515,
      align: 'center'
    });

  doc.y += 18;

  const boxWidth = 230;
  const boxHeight = 68;
  const leftX = 40;
  const rightX = 320;
  const titleY = doc.y;
  const boxY = titleY + 14;
  const lineOffset = 79;
  const nameOffset = 86;

  doc.font('Helvetica').fontSize(10).text('Assinatura do vistoriador:', leftX, titleY, {
    width: boxWidth
  });
  doc.text('Assinatura do cliente:', rightX, titleY, {
    width: boxWidth
  });

  doc.rect(leftX, boxY, boxWidth, boxHeight).stroke('#d9d9d9');
  doc.rect(rightX, boxY, boxWidth, boxHeight).stroke('#d9d9d9');

  const inspectorBuffer = extractBase64Image(inspection.inspectorSignature);
  if (inspectorBuffer) {
    try {
      doc.image(inspectorBuffer, leftX + 10, boxY + 8, {
        fit: [boxWidth - 20, boxHeight - 16],
        align: 'center',
        valign: 'center'
      });
    } catch (error) {
      doc.fontSize(8.5).text('Assinatura inválida', leftX, boxY + 28, {
        width: boxWidth,
        align: 'center'
      });
    }
  } else {
    doc.fontSize(8.5).text('Não informada', leftX, boxY + 28, {
      width: boxWidth,
      align: 'center'
    });
  }

  const clientBuffer = extractBase64Image(inspection.clientSignature);
  if (clientBuffer) {
    try {
      doc.image(clientBuffer, rightX + 10, boxY + 8, {
        fit: [boxWidth - 20, boxHeight - 16],
        align: 'center',
        valign: 'center'
      });
    } catch (error) {
      doc.fontSize(8.5).text('Assinatura inválida', rightX, boxY + 28, {
        width: boxWidth,
        align: 'center'
      });
    }
  } else {
    doc.fontSize(8.5).text('Não informada', rightX, boxY + 28, {
      width: boxWidth,
      align: 'center'
    });
  }

  doc.moveTo(leftX, boxY + lineOffset).lineTo(leftX + boxWidth, boxY + lineOffset).stroke('#d9d9d9');
  doc.moveTo(rightX, boxY + lineOffset).lineTo(rightX + boxWidth, boxY + lineOffset).stroke('#d9d9d9');

  doc.fontSize(8.5).fillColor('#111111');
  doc.text('Vistoriador', leftX, boxY + nameOffset, {
    width: boxWidth,
    align: 'center'
  });
  doc.text('Cliente', rightX, boxY + nameOffset, {
    width: boxWidth,
    align: 'center'
  });

  doc.y = boxY + 104;
}

class ReportService {
  async generateInspectionReport(res, inspection) {
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4'
    });

    const apartmentNumber = inspection?.apartment?.number || 'sem-numero';
    const inspectionId = inspection?.id || 'sem-id';
    const fileName = `vistoria-${apartmentNumber}-${inspectionId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    doc.pipe(res);

    drawHeaderBlock(doc, inspection);
    drawMetricsBlock(doc, getInspectionMetrics(inspection.items));

    const groupedLocations = groupItemsByLocation(inspection.items);

    for (const group of groupedLocations) {
      await drawLocationSection(doc, group);
    }

    drawSignaturesBlock(doc, inspection);
    doc.end();
  }
}

module.exports = new ReportService();
