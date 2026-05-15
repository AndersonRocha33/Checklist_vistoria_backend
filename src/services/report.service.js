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

function getItemCategory(item) {
  return item?.checklistItem?.category || 'Sem categoria';
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

function groupItemsByCategoryAndLocation(items) {
  const grouped = {};

  for (const item of items) {
    const category = getItemCategory(item);
    const location = item.checklistItem.location || 'Sem localização';

    if (!grouped[category]) {
      grouped[category] = {};
    }

    if (!grouped[category][location]) {
      grouped[category][location] = [];
    }

    grouped[category][location].push(item);
  }

  return Object.keys(grouped)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((category) => ({
      category,
      locations: Object.keys(grouped[category])
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))
        .map((location) => ({
          location,
          items: grouped[category][location].sort((a, b) =>
            (a.checklistItem.itemName || '').localeCompare(
              b.checklistItem.itemName || '',
              'pt-BR'
            )
          )
        }))
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
  const logoPath = path.resolve(__dirname, '../assets/spotlar-logo.png');
  const hasLogo = fs.existsSync(logoPath);

  if (hasLogo) {
    try {
      doc.image(logoPath, 40, 32, {
        fit: [150, 50],
        align: 'left'
      });
    } catch (error) {
      console.error('Erro ao carregar logo do relatório:', error.message);
    }
  }

  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#6b7280')
    .text('pronto para morar', 58, 84, {
      width: 140,
      align: 'left',
      lineBreak: false
    });

  doc
    .strokeColor('#d1d5db')
    .lineWidth(1)
    .moveTo(210, 35)
    .lineTo(210, 98)
    .stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#111827')
    .text('Relatório de Checklist de Entrega', 230, 42, {
      width: 300,
      align: 'left'
    });

  doc
    .lineWidth(0.8)
    .roundedRect(40, 118, 515, 74, 8)
    .stroke('#d1d5db');

  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor('#111827')
    .text('Empreendimento:', 55, 134)
    .font('Helvetica')
    .text(inspection.apartment.enterprise.name, 140, 134, { width: 150 })

    .font('Helvetica-Bold')
    .text('Apartamento:', 55, 154)
    .font('Helvetica')
    .text(String(inspection.apartment.number), 140, 154, { width: 150 })

    .font('Helvetica-Bold')
    .text('Responsável:', 55, 174)
    .font('Helvetica')
    .text(inspection.user.name, 140, 174, { width: 150 });

  doc
    .font('Helvetica-Bold')
    .text('Data da emissão:', 310, 134)
    .font('Helvetica')
    .text(new Date(inspection.updatedAt).toLocaleString('pt-BR'), 410, 134, {
      width: 125
    })

    .font('Helvetica-Bold')
    .text('Status:', 310, 154)
    .font('Helvetica')
    .text(inspection.status, 410, 154, { width: 125 })

    .font('Helvetica-Bold')
    .text('ID:', 310, 174)
    .font('Helvetica')
    .text(inspection.id, 410, 174, { width: 125 });

  doc.y = 208;
}

function drawPendingHeaderBlock(doc, inspection, selectedCategories) {
  const logoPath = path.resolve(__dirname, '../assets/spotlar-logo.png');
  const hasLogo = fs.existsSync(logoPath);

  if (hasLogo) {
    try {
      doc.image(logoPath, 40, 32, {
        fit: [150, 50],
        align: 'left'
      });
    } catch (error) {
      console.error('Erro ao carregar logo do relatório:', error.message);
    }
  }

  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#6b7280')
    .text('pronto para morar', 58, 84, {
      width: 140,
      align: 'left',
      lineBreak: false
    });

  doc
    .strokeColor('#d1d5db')
    .lineWidth(1)
    .moveTo(210, 35)
    .lineTo(210, 98)
    .stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#111827')
    .text('Relatório de Pendências', 230, 42, {
      width: 300,
      align: 'left'
    });

  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor('#6b7280')
    .text('Itens não conformes filtrados por categoria', 230, 68, {
      width: 300,
      align: 'left'
    });

  doc
    .lineWidth(0.8)
    .roundedRect(40, 118, 515, 92, 8)
    .stroke('#d1d5db');

  const categoriesText =
    selectedCategories && selectedCategories.length > 0
      ? selectedCategories.join(', ')
      : 'Todas as categorias';

  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor('#111827')
    .text('Empreendimento:', 55, 132)
    .font('Helvetica')
    .text(inspection.apartment.enterprise.name, 140, 132, { width: 150 })

    .font('Helvetica-Bold')
    .text('Apartamento:', 55, 152)
    .font('Helvetica')
    .text(String(inspection.apartment.number), 140, 152, { width: 150 })

    .font('Helvetica-Bold')
    .text('Responsável:', 55, 172)
    .font('Helvetica')
    .text(inspection.user.name, 140, 172, { width: 150 })

    .font('Helvetica-Bold')
    .text('Categorias:', 55, 192)
    .font('Helvetica')
    .text(categoriesText, 140, 192, { width: 390 });

  doc
    .font('Helvetica-Bold')
    .text('Data da emissão:', 310, 132)
    .font('Helvetica')
    .text(new Date().toLocaleString('pt-BR'), 410, 132, {
      width: 125
    })

    .font('Helvetica-Bold')
    .text('Status:', 310, 152)
    .font('Helvetica')
    .text(inspection.status, 410, 152, { width: 125 })

    .font('Helvetica-Bold')
    .text('ID:', 310, 172)
    .font('Helvetica')
    .text(inspection.id, 410, 172, { width: 125 });

  doc.y = 228;
}

function drawMetricsBlock(doc, metrics) {
  ensurePageSpace(doc, 52);

  const startY = doc.y;
  const boxWidth = 118;
  const gap = 13;
  const startX = 40;

  const cards = [
    { label: 'TOTAL', value: metrics.total, color: '#111111' },
    { label: 'CONFORMES', value: metrics.conforme, color: '#2f7d32' },
    { label: 'NÃO CONFORMES', value: metrics.naoConforme, color: '#c62828' },
    { label: 'PENDENTES', value: metrics.pendente, color: '#d97706' }
  ];

  cards.forEach((card, index) => {
    const x = startX + index * (boxWidth + gap);

    doc
      .lineWidth(0.6)
      .roundedRect(x, startY, boxWidth, 42, 7)
      .stroke('#d1d5db');

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#444444')
      .text(card.label, x + 8, startY + 8, {
        width: boxWidth - 16,
        align: 'center'
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(15)
      .fillColor(card.color)
      .text(String(card.value), x + 8, startY + 22, {
        width: boxWidth - 16,
        align: 'center'
      });
  });

  doc.y = startY + 52;
}

function drawPendingMetricsBlock(doc, totalPending) {
  ensurePageSpace(doc, 52);

  const startY = doc.y;
  const startX = 40;
  const boxWidth = 515;

  doc
    .lineWidth(0.6)
    .roundedRect(startX, startY, boxWidth, 42, 7)
    .stroke('#d1d5db');

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#444444')
    .text('TOTAL DE PENDÊNCIAS DO RELATÓRIO', startX + 12, startY + 8, {
      width: boxWidth - 24,
      align: 'center'
    });

  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#c62828')
    .text(String(totalPending), startX + 12, startY + 22, {
      width: boxWidth - 24,
      align: 'center'
    });

  doc.y = startY + 52;
}

function drawLocationTitle(doc, location) {
  ensurePageSpace(doc, 42);

  const startY = doc.y + 4;

  doc
    .font('Helvetica-Bold')
    .fontSize(10.5)
    .fillColor('#222222')
    .text(`Localização: ${location}`, 40, startY);

  doc
    .moveTo(40, startY + 15)
    .lineTo(555, startY + 15)
    .lineWidth(0.6)
    .stroke('#d1d5db');

  doc.y = startY + 20;
}

function drawCategoryTitle(doc, category) {
  ensurePageSpace(doc, 48);

  const startY = doc.y + 6;

  doc
    .roundedRect(40, startY, 515, 24, 6)
    .fill('#f3f4f6');

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#111827')
    .text(`Categoria: ${category}`, 50, startY + 7, {
      width: 495
    });

  doc.y = startY + 34;
}

function getStatusTextStyle(status) {
  if (status === 'CONFORME') {
    return { color: '#2f7d32', label: 'CONFORME' };
  }

  if (status === 'NAO_CONFORME') {
    return { color: '#c62828', label: 'NAO_CONFORME' };
  }

  return { color: '#d97706', label: 'PENDENTE' };
}

function drawTableHeader(doc) {
  ensurePageSpace(doc, 24);

  const startX = 40;
  const startY = doc.y;
  const itemColWidth = 385;
  const qtyColWidth = 45;
  const statusColWidth = 85;
  const headerHeight = 16;

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#444444');

  doc.text('ITEM', startX + 6, startY + 4, {
    width: itemColWidth - 12,
    lineBreak: false
  });

  doc.text('QTDE', startX + itemColWidth, startY + 4, {
    width: qtyColWidth,
    align: 'center',
    lineBreak: false
  });

  doc.text('STATUS', startX + itemColWidth + qtyColWidth, startY + 4, {
    width: statusColWidth,
    align: 'center',
    lineBreak: false
  });

  doc
    .moveTo(startX, startY + headerHeight)
    .lineTo(555, startY + headerHeight)
    .lineWidth(0.6)
    .stroke('#d1d5db');

  doc.font('Helvetica').fillColor('#111111');
  doc.y = startY + headerHeight + 2;
}

function drawPendingTableHeader(doc) {
  ensurePageSpace(doc, 24);

  const startX = 40;
  const startY = doc.y;
  const itemColWidth = 420;
  const qtyColWidth = 55;
  const headerHeight = 16;

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#444444');

  doc.text('ITEM', startX + 6, startY + 4, {
    width: itemColWidth - 12,
    lineBreak: false
  });

  doc.text('QTDE', startX + itemColWidth, startY + 4, {
    width: qtyColWidth,
    align: 'center',
    lineBreak: false
  });

  doc.text('STATUS', startX + itemColWidth + qtyColWidth, startY + 4, {
    width: 40,
    align: 'center',
    lineBreak: false
  });

  doc
    .moveTo(startX, startY + headerHeight)
    .lineTo(555, startY + headerHeight)
    .lineWidth(0.6)
    .stroke('#d1d5db');

  doc.font('Helvetica').fillColor('#111111');
  doc.y = startY + headerHeight + 2;
}

function getRowHeight(doc, itemName, width) {
  doc.font('Helvetica').fontSize(8.1);

  const textHeight = doc.heightOfString(itemName || '-', {
    width,
    align: 'left'
  });

  return Math.max(14, textHeight + 3);
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

function getPhotoList(item) {
  if (Array.isArray(item.photoUrls) && item.photoUrls.length > 0) {
    return item.photoUrls.filter(Boolean).slice(0, 2);
  }

  if (item.photoUrl) {
    return [item.photoUrl];
  }

  return [];
}

function getInlineNonConformHeight(doc, item, photoCount) {
  const notesText = item.notes || '-';

  doc.font('Helvetica').fontSize(8.5);

  const notesHeight = doc.heightOfString(notesText, {
    width: 455
  });

  const baseHeight = 10 + notesHeight + 8;

  if (photoCount === 0) {
    return Math.max(28, baseHeight);
  }

  return Math.max(175, baseHeight + 138);
}

async function drawInlineNonConformDetails(doc, item) {
  const startX = 58;
  const width = 480;
  const photos = getPhotoList(item);
  const photoCount = photos.length;
  const blockHeight = getInlineNonConformHeight(doc, item, photoCount);

  ensurePageSpace(doc, blockHeight + 4);

  const startY = doc.y;

  doc
    .lineWidth(0.5)
    .roundedRect(startX, startY, width, blockHeight, 5)
    .stroke('#e4e4e4');

  let currentY = startY + 8;

  doc.font('Helvetica').fontSize(8.5).fillColor('#111111');
  doc.text(item.notes || '-', startX + 9, currentY, {
    width: width - 18
  });

  const notesHeight = doc.heightOfString(item.notes || '-', {
    width: width - 18
  });

  currentY += notesHeight + 8;

  if (photoCount > 0) {
    try {
      const imageBuffers = [];

      for (let i = 0; i < photoCount; i++) {
        const buffer = await getImageBuffer(photos[i]);
        if (buffer) {
          imageBuffers.push(buffer);
        }
      }

      if (imageBuffers.length === 1) {
        const photoWidth = 220;
        const photoHeight = 130;
        const photoX = startX + (width - photoWidth) / 2;

        doc.image(imageBuffers[0], photoX, currentY, {
          fit: [photoWidth, photoHeight],
          align: 'center',
          valign: 'center'
        });
      }

      if (imageBuffers.length === 2) {
        const photoWidth = 220;
        const photoHeight = 130;
        const gap = 12;
        const totalWidth = photoWidth * 2 + gap;
        const firstX = startX + (width - totalWidth) / 2;
        const secondX = firstX + photoWidth + gap;

        doc.image(imageBuffers[0], firstX, currentY, {
          fit: [photoWidth, photoHeight],
          align: 'center',
          valign: 'center'
        });

        doc.image(imageBuffers[1], secondX, currentY, {
          fit: [photoWidth, photoHeight],
          align: 'center',
          valign: 'center'
        });
      }
    } catch (error) {
      console.error('Erro ao carregar imagem no relatório:', error.message);

      doc.font('Helvetica').fillColor('#c62828').fontSize(8).text(
        'Não foi possível carregar a foto deste item.',
        startX + 9,
        currentY + 4
      );

      doc.fillColor('#111111');
    }
  }

  doc.y = startY + blockHeight + 3;
}

async function drawLocationSection(doc, group) {
  ensurePageSpace(doc, 68);
  drawLocationTitle(doc, group.location);
  drawTableHeader(doc);

  const startX = 40;
  const itemColWidth = 385;
  const qtyColWidth = 45;
  const statusColWidth = 85;

  for (const item of group.items) {
    const itemName = item.checklistItem.itemName || '-';
    const rowHeight = getRowHeight(doc, itemName, itemColWidth - 14);
    const isNonConform = item.status === 'NAO_CONFORME';
    const photoCount = getPhotoList(item).length;
    const detailsHeight = isNonConform
      ? getInlineNonConformHeight(doc, item, photoCount) + 4
      : 0;

    const minSpace = rowHeight + detailsHeight + 5;

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
      .lineWidth(0.35)
      .stroke('#eeeeee');

    doc.font('Helvetica').fontSize(8.1).fillColor('#111111');
    doc.text(itemName, startX + 6, y + 1, {
      width: itemColWidth - 14
    });

    doc.text(String(item.checklistItem.quantity || 0), startX + itemColWidth, y + 1, {
      width: qtyColWidth,
      align: 'center',
      lineBreak: false
    });

    doc.font('Helvetica-Bold').fontSize(8).fillColor(statusStyle.color).text(
      statusStyle.label,
      startX + itemColWidth + qtyColWidth,
      y + 1,
      {
        width: statusColWidth,
        align: 'center',
        lineBreak: false
      }
    );

    doc.fillColor('#111111');
    doc.y = y + rowHeight;

    if (isNonConform) {
      await drawInlineNonConformDetails(doc, item);
    }
  }

  doc.y += 4;
}

function getPendingDetailsHeight(doc, item, photoCount) {
  const notesText = item.notes || '-';

  doc.font('Helvetica').fontSize(8.5);

  const notesHeight = doc.heightOfString(notesText, {
    width: 490
  });

  const baseHeight = 34 + notesHeight + 10;

  if (photoCount === 0) {
    return Math.max(54, baseHeight);
  }

  return Math.max(192, baseHeight + 138);
}

async function drawPendingDetails(doc, item) {
  const startX = 40;
  const width = 515;
  const photos = getPhotoList(item);
  const photoCount = photos.length;
  const blockHeight = getPendingDetailsHeight(doc, item, photoCount);

  ensurePageSpace(doc, blockHeight + 6);

  const startY = doc.y;

  doc
    .lineWidth(0.5)
    .roundedRect(startX, startY, width, blockHeight, 6)
    .stroke('#e5e7eb');

  let currentY = startY + 8;

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#111827')
    .text('Observação:', startX + 10, currentY, {
      width: width - 20
    });

  currentY += 12;

  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor('#111111')
    .text(item.notes || '-', startX + 10, currentY, {
      width: width - 20
    });

  const notesHeight = doc.heightOfString(item.notes || '-', {
    width: width - 20
  });

  currentY += notesHeight + 10;

  if (photoCount > 0) {
    try {
      const imageBuffers = [];

      for (let i = 0; i < photoCount; i++) {
        const buffer = await getImageBuffer(photos[i]);
        if (buffer) {
          imageBuffers.push(buffer);
        }
      }

      if (imageBuffers.length === 1) {
        const photoWidth = 250;
        const photoHeight = 135;
        const photoX = startX + (width - photoWidth) / 2;

        doc.image(imageBuffers[0], photoX, currentY, {
          fit: [photoWidth, photoHeight],
          align: 'center',
          valign: 'center'
        });
      }

      if (imageBuffers.length === 2) {
        const photoWidth = 240;
        const photoHeight = 135;
        const gap = 12;
        const totalWidth = photoWidth * 2 + gap;
        const firstX = startX + (width - totalWidth) / 2;
        const secondX = firstX + photoWidth + gap;

        doc.image(imageBuffers[0], firstX, currentY, {
          fit: [photoWidth, photoHeight],
          align: 'center',
          valign: 'center'
        });

        doc.image(imageBuffers[1], secondX, currentY, {
          fit: [photoWidth, photoHeight],
          align: 'center',
          valign: 'center'
        });
      }
    } catch (error) {
      console.error('Erro ao carregar imagem no relatório de pendências:', error.message);

      doc.font('Helvetica').fillColor('#c62828').fontSize(8).text(
        'Não foi possível carregar a foto deste item.',
        startX + 10,
        currentY + 4
      );

      doc.fillColor('#111111');
    }
  }

  doc.y = startY + blockHeight + 6;
}

async function drawPendingLocationSection(doc, group) {
  ensurePageSpace(doc, 68);
  drawLocationTitle(doc, group.location);
  drawPendingTableHeader(doc);

  const startX = 40;
  const itemColWidth = 420;
  const qtyColWidth = 55;

  for (const item of group.items) {
    const itemName = item.checklistItem.itemName || '-';
    const rowHeight = getRowHeight(doc, itemName, itemColWidth - 14);
    const photoCount = getPhotoList(item).length;
    const detailsHeight = getPendingDetailsHeight(doc, item, photoCount) + 6;

    const minSpace = rowHeight + detailsHeight + 8;

    if (doc.y + minSpace > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawLocationTitle(doc, group.location);
      drawPendingTableHeader(doc);
    }

    const y = doc.y;

    doc
      .moveTo(startX, y - 2)
      .lineTo(555, y - 2)
      .lineWidth(0.35)
      .stroke('#eeeeee');

    doc.font('Helvetica').fontSize(8.1).fillColor('#111111');
    doc.text(itemName, startX + 6, y + 1, {
      width: itemColWidth - 14
    });

    doc.text(String(item.checklistItem.quantity || 0), startX + itemColWidth, y + 1, {
      width: qtyColWidth,
      align: 'center',
      lineBreak: false
    });

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#c62828').text(
      'NC',
      startX + itemColWidth + qtyColWidth,
      y + 1,
      {
        width: 40,
        align: 'center',
        lineBreak: false
      }
    );

    doc.fillColor('#111111');
    doc.y = y + rowHeight + 2;

    await drawPendingDetails(doc, item);
  }

  doc.y += 4;
}

function drawSignaturesBlock(doc, inspection) {
  ensurePageSpace(doc, 130);

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#111111')
    .text('Assinaturas', 40, doc.y, {
      width: 515,
      align: 'center'
    });

  doc.y += 16;

  const boxWidth = 230;
  const boxHeight = 62;
  const leftX = 40;
  const rightX = 320;
  const titleY = doc.y;
  const boxY = titleY + 13;
  const lineOffset = 73;
  const nameOffset = 80;

  doc.font('Helvetica').fontSize(9).text('Assinatura do vistoriador:', leftX, titleY, {
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
      doc.fontSize(8).text('Assinatura inválida', leftX, boxY + 26, {
        width: boxWidth,
        align: 'center'
      });
    }
  } else {
    doc.fontSize(8).text('Não informada', leftX, boxY + 26, {
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
      doc.fontSize(8).text('Assinatura inválida', rightX, boxY + 26, {
        width: boxWidth,
        align: 'center'
      });
    }
  } else {
    doc.fontSize(8).text('Não informada', rightX, boxY + 26, {
      width: boxWidth,
      align: 'center'
    });
  }

  doc.moveTo(leftX, boxY + lineOffset).lineTo(leftX + boxWidth, boxY + lineOffset).stroke('#d9d9d9');
  doc.moveTo(rightX, boxY + lineOffset).lineTo(rightX + boxWidth, boxY + lineOffset).stroke('#d9d9d9');

  doc.fontSize(8).fillColor('#111111');
  doc.text('Vistoriador', leftX, boxY + nameOffset, {
    width: boxWidth,
    align: 'center'
  });
  doc.text('Cliente', rightX, boxY + nameOffset, {
    width: boxWidth,
    align: 'center'
  });

  doc.y = boxY + 96;
}

function sanitizeFileName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
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

  async generatePendingInspectionReport(res, inspection, options = {}) {
    const selectedCategories = Array.isArray(options.categories)
      ? options.categories.filter(Boolean)
      : [];

    const normalizedSelectedCategories = selectedCategories.map((category) =>
      String(category).trim().toLowerCase()
    );

    let pendingItems = inspection.items.filter((item) => item.status === 'NAO_CONFORME');

    if (normalizedSelectedCategories.length > 0) {
      pendingItems = pendingItems.filter((item) =>
        normalizedSelectedCategories.includes(getItemCategory(item).trim().toLowerCase())
      );
    }

    const doc = new PDFDocument({
      margin: 40,
      size: 'A4'
    });

    const apartmentNumber = inspection?.apartment?.number || 'sem-numero';
    const categoriesSlug =
      selectedCategories.length > 0
        ? sanitizeFileName(selectedCategories.join('-'))
        : 'todas-categorias';

    const fileName = `pendencias-${apartmentNumber}-${categoriesSlug}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    doc.pipe(res);

    drawPendingHeaderBlock(doc, inspection, selectedCategories);
    drawPendingMetricsBlock(doc, pendingItems.length);

    if (pendingItems.length === 0) {
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#111827')
        .text('Nenhuma pendência encontrada para o filtro selecionado.', 40, doc.y + 14, {
          width: 515,
          align: 'center'
        });

      doc.end();
      return;
    }

    const groupedCategories = groupItemsByCategoryAndLocation(pendingItems);

    for (const categoryGroup of groupedCategories) {
      drawCategoryTitle(doc, categoryGroup.category);

      for (const locationGroup of categoryGroup.locations) {
        await drawPendingLocationSection(doc, locationGroup);
      }
    }

    doc.end();
  }
}

module.exports = new ReportService();