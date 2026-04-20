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
      doc.image(logoPath, 40, 34, { fit: [100, 46] });
    } catch (error) {
      console.error('Erro ao carregar logo do relatório:', error.message);
    }
  }

  doc
    .fontSize(20)
    .fillColor('#111827')
    .text('Relatório de Checklist de Entrega', hasLogo ? 160 : 40, 40, {
      width: 360,
      align: 'left'
    });

  doc
    .fontSize(9)
    .fillColor('#6b7280')
    .text('Relatório de vistoria do apartamento decorado', hasLogo ? 160 : 40, 67, {
      width: 360,
      align: 'left'
    });

  doc.roundedRect(40, 102, 515, 78, 12).fillAndStroke('#f8fafc', '#dbeafe');

  doc.fillColor('#111827').fontSize(10.5);
  doc.text(`Empreendimento: ${inspection.apartment.enterprise.name}`, 54, 117);
  doc.text(`Apartamento: ${inspection.apartment.number}`, 54, 136);
  doc.text(`Responsável: ${inspection.user.name}`, 54, 155);

  doc.text(
    `Data da emissão: ${new Date(inspection.updatedAt).toLocaleString('pt-BR')}`,
    305,
    117
  );
  doc.text(`Status da vistoria: ${inspection.status}`, 305, 136);
  doc.text(`ID da vistoria: ${inspection.id}`, 305, 155);

  doc.fillColor('#111827');
  doc.y = 195;
}

function drawMetricsBlock(doc, metrics) {
  ensurePageSpace(doc, 82);

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

    doc.roundedRect(x, startY, boxWidth, 58, 10).fillAndStroke(card.color, card.border);

    doc.fillColor('#6b7280').fontSize(9).text(card.label, x + 8, startY + 10, {
      width: boxWidth - 16,
      align: 'center'
    });

    doc.fillColor('#111827').fontSize(20).text(String(card.value), x + 8, startY + 27, {
      width: boxWidth - 16,
      align: 'center'
    });
  });

  doc.fillColor('#111827');
  doc.y = startY + 72;
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

function drawStatusBadge(doc, status, x, y, width = 96, height = 18) {
  const colors = getStatusColors(status);

  doc.roundedRect(x, y, width, height, 8).fillAndStroke(colors.bg, colors.border);
  doc.fillColor(colors.text).fontSize(8.5).text(status, x, y + 5, {
    width,
    align: 'center'
  });
  doc.fillColor('#111827');
}

function drawLocationTitle(doc, location) {
  ensurePageSpace(doc, 36);

  const startY = doc.y;
  doc.roundedRect(40, startY, 515, 24, 8).fill('#e0e7ff');
  doc.fillColor('#1e3a8a').fontSize(12).text(`Localização: ${location}`, 52, startY + 7);
  doc.fillColor('#111827');
  doc.y = startY + 32;
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

function drawItemsTable(doc, items) {
  const headerHeight = 22;
  const rowHeight = 18;
  const startX = 40;
  const tableWidth = 515;
  const itemColWidth = 365;
  const qtyColWidth = 50;
  const statusColWidth = 100;
  const minHeightNeeded = headerHeight + items.length * rowHeight + 18;

  ensurePageSpace(doc, minHeightNeeded);

  const startY = doc.y;

  doc.roundedRect(startX, startY, tableWidth, headerHeight, 6).fillAndStroke('#f8fafc', '#e5e7eb');

  doc.fillColor('#374151').fontSize(9).font('Helvetica-Bold');
  doc.text('ITEM', startX + 10, startY + 7, { width: itemColWidth - 12 });
  doc.text('QTDE', startX + itemColWidth, startY + 7, {
    width: qtyColWidth,
    align: 'center'
  });
  doc.text('STATUS', startX + itemColWidth + qtyColWidth, startY + 7, {
    width: statusColWidth,
    align: 'center'
  });

  let y = startY + headerHeight;

  items.forEach((item, index) => {
    const rowBg = index % 2 === 0 ? '#ffffff' : '#fafafa';

    doc.rect(startX, y, tableWidth, rowHeight).fillAndStroke(rowBg, '#f1f5f9');

    doc.fillColor('#111827').fontSize(8.5).font('Helvetica');
    doc.text(item.checklistItem.itemName || '-', startX + 10, y + 5, {
      width: itemColWidth - 16,
      ellipsis: true
    });

    doc.text(String(item.checklistItem.quantity || 0), startX + itemColWidth, y + 5, {
      width: qtyColWidth,
      align: 'center'
    });

    drawStatusBadge(
      doc,
      item.status,
      startX + itemColWidth + qtyColWidth + 2,
      y + 1,
      statusColWidth - 4,
      16
    );

    y += rowHeight;
  });

  doc.font('Helvetica').fillColor('#111827');
  doc.y = y + 10;
}

function getNonConformItemHeight(doc, item, hasPhoto) {
  const contentWidth = 330;
  const itemName = item.checklistItem.itemName || '-';
  const notesText = `Observações: ${item.notes || '-'}`;

  doc.font('Helvetica-Bold').fontSize(12);
  const itemNameHeight = doc.heightOfString(itemName, {
    width: contentWidth,
    align: 'left'
  });

  doc.font('Helvetica').fontSize(10);
  const notesHeight = doc.heightOfString(notesText, {
    width: 455,
    align: 'left'
  });

  const baseHeight = 24 + itemNameHeight + 10 + 16 + 6 + notesHeight + 16;

  if (!hasPhoto) {
    return Math.max(104, baseHeight + 10);
  }

  return Math.max(285, baseHeight + 175);
}

async function drawNonConformItem(doc, item) {
  const hasPhoto = Boolean(item.photoUrl);
  const sectionHeight = getNonConformItemHeight(doc, item, hasPhoto);

  ensurePageSpace(doc, sectionHeight + 10);

  const startX = 40;
  const startY = doc.y;
  const width = 515;
  const titleWidth = 330;

  doc.roundedRect(startX, startY, width, sectionHeight, 10).stroke('#e5e7eb');

  doc.font('Helvetica-Bold').fillColor('#111827').fontSize(12);
  doc.text(item.checklistItem.itemName || '-', startX + 14, startY + 14, {
    width: titleWidth
  });

  drawStatusBadge(doc, 'NAO_CONFORME', 430, startY + 12, 110, 20);

  const itemNameHeight = doc.heightOfString(item.checklistItem.itemName || '-', {
    width: titleWidth
  });

  let currentY = startY + 16 + itemNameHeight + 10;

  doc.font('Helvetica').fontSize(10).fillColor('#111827');
  doc.text(`Quantidade: ${item.checklistItem.quantity}`, startX + 14, currentY);

  currentY += 18;

  const notesText = `Observações: ${item.notes || '-'}`;
  doc.text(notesText, startX + 14, currentY, {
    width: 455
  });

  const notesHeight = doc.heightOfString(notesText, {
    width: 455
  });

  currentY += notesHeight + 12;

  if (hasPhoto) {
    doc.font('Helvetica').fontSize(10).fillColor('#374151');
    doc.text('Foto da não conformidade:', startX + 14, currentY);

    currentY += 18;

    try {
      const imageBuffer = await getImageBuffer(item.photoUrl);

      if (!imageBuffer) {
        throw new Error('Imagem não encontrada ou vazia.');
      }

      const photoWidth = 240;
      const photoHeight = 150;
      const photoX = startX + (width - photoWidth) / 2;

      doc.image(imageBuffer, photoX, currentY, {
        fit: [photoWidth, photoHeight],
        align: 'center',
        valign: 'center'
      });
    } catch (error) {
      console.error('Erro ao carregar imagem no relatório:', error.message);
      console.error('URL da imagem:', item.photoUrl);

      doc.fillColor('#991b1b').fontSize(9).text(
        'Não foi possível carregar a foto deste item.',
        startX + 14,
        currentY + 8
      );
      doc.fillColor('#111827');
    }
  }

  doc.font('Helvetica').fillColor('#111827');
  doc.y = startY + sectionHeight + 10;
}

async function drawLocationSection(doc, group) {
  drawLocationTitle(doc, group.location);
  drawItemsTable(doc, group.items);

  const nonConformItems = group.items.filter((item) => item.status === 'NAO_CONFORME');

  for (const item of nonConformItems) {
    await drawNonConformItem(doc, item);
  }

  doc.y += 2;
}

function drawSignaturesBlock(doc, inspection) {
  ensurePageSpace(doc, 170);

  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text('Assinaturas', 40, doc.y, {
    width: 515,
    align: 'center',
    underline: true
  });

  doc.y += 24;

  const boxWidth = 230;
  const boxHeight = 78;
  const leftX = 40;
  const rightX = 320;
  const titleY = doc.y;
  const boxY = titleY + 16;
  const lineOffset = 90;
  const nameOffset = 98;

  doc.font('Helvetica').fontSize(11).text('Assinatura do vistoriador:', leftX, titleY, {
    width: boxWidth
  });
  doc.text('Assinatura do cliente:', rightX, titleY, {
    width: boxWidth
  });

  doc.rect(leftX, boxY, boxWidth, boxHeight).stroke('#bbf7d0');
  doc.rect(rightX, boxY, boxWidth, boxHeight).stroke('#bbf7d0');

  const inspectorBuffer = extractBase64Image(inspection.inspectorSignature);
  if (inspectorBuffer) {
    try {
      doc.image(inspectorBuffer, leftX + 12, boxY + 8, {
        fit: [boxWidth - 24, boxHeight - 18],
        align: 'center',
        valign: 'center'
      });
    } catch (error) {
      doc.fontSize(9).text('Assinatura inválida', leftX, boxY + 30, {
        width: boxWidth,
        align: 'center'
      });
    }
  } else {
    doc.fontSize(9).text('Não informada', leftX, boxY + 30, {
      width: boxWidth,
      align: 'center'
    });
  }

  const clientBuffer = extractBase64Image(inspection.clientSignature);
  if (clientBuffer) {
    try {
      doc.image(clientBuffer, rightX + 12, boxY + 8, {
        fit: [boxWidth - 24, boxHeight - 18],
        align: 'center',
        valign: 'center'
      });
    } catch (error) {
      doc.fontSize(9).text('Assinatura inválida', rightX, boxY + 30, {
        width: boxWidth,
        align: 'center'
      });
    }
  } else {
    doc.fontSize(9).text('Não informada', rightX, boxY + 30, {
      width: boxWidth,
      align: 'center'
    });
  }

  doc.moveTo(leftX, boxY + lineOffset).lineTo(leftX + boxWidth, boxY + lineOffset).stroke('#bbf7d0');
  doc.moveTo(rightX, boxY + lineOffset).lineTo(rightX + boxWidth, boxY + lineOffset).stroke('#bbf7d0');

  doc.fontSize(9).fillColor('#111827');
  doc.text('Vistoriador', leftX, boxY + nameOffset, {
    width: boxWidth,
    align: 'center'
  });
  doc.text('Cliente', rightX, boxY + nameOffset, {
    width: boxWidth,
    align: 'center'
  });

  doc.y = boxY + 118;
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
