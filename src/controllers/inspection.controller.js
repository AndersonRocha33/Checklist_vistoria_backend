const prisma = require('../lib/prisma');
const { InspectionStatus, ItemStatus } = require('@prisma/client');
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
        a.checklistItem.itemName.localeCompare(b.checklistItem.itemName, 'pt-BR')
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

  doc
    .roundedRect(40, 110, 515, 88, 12)
    .fillAndStroke('#f8fafc', '#dbeafe');

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

    doc
      .fillColor('#6b7280')
      .fontSize(10)
      .text(card.label, x + 10, startY + 12, {
        width: boxWidth - 20,
        align: 'center'
      });

    doc
      .fillColor('#111827')
      .fontSize(24)
      .text(String(card.value), x + 10, startY + 32, {
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

function drawStatusBadge(doc, status, x, y, width = 110) {
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

  doc
    .fillColor('#1e3a8a')
    .fontSize(13)
    .text(`Localização: ${location}`, 52, startY + 8);

  doc.fillColor('#111827');
  doc.y = startY + 40;
}

async function drawItemSection(doc, item) {
  const hasPhoto = item.status === 'NAO_CONFORME' && item.photoUrl;

  ensurePageSpace(doc, hasPhoto ? 420 : 120);

  const sectionTop = doc.y;

  doc
    .roundedRect(40, sectionTop, 515, hasPhoto ? 360 : 105, 10)
    .stroke('#e5e7eb');

  const badgeWidth = 115;
  const badgeX = 425;
  const contentX = 55;
  const contentWidth = 345;

  const itemName = item.checklistItem.itemName || '-';

  doc
    .fillColor('#111827')
    .fontSize(13)
    .text(itemName, contentX, sectionTop + 14, {
      width: contentWidth,
      align: 'left'
    });

  drawStatusBadge(doc, item.status, badgeX, sectionTop + 14, badgeWidth);

  const itemNameHeight = doc.heightOfString(itemName, {
    width: contentWidth,
    align: 'left'
  });

  const detailY = sectionTop + 20 + itemNameHeight;

  doc.fontSize(11).fillColor('#111827');
  doc.text(`Quantidade: ${item.checklistItem.quantity}`, contentX, detailY);
  doc.text(`Observações: ${item.notes || '-'}`, contentX, detailY + 20, {
    width: 470
  });

  if (!hasPhoto) {
    doc.y = sectionTop + 118;
    return;
  }

  doc
    .fillColor('#374151')
    .fontSize(11)
    .text('Foto da não conformidade:', contentX, sectionTop + 95);

  try {
    const imageResponse = await axios.get(item.photoUrl, {
      responseType: 'arraybuffer'
    });

    const imageBuffer = Buffer.from(imageResponse.data, 'binary');

    const photoWidth = 320;
    const photoHeight = 220;
    const photoX = 40 + (515 - photoWidth) / 2;
    const photoY = sectionTop + 120;

    doc.image(imageBuffer, photoX, photoY, {
      fit: [photoWidth, photoHeight],
      align: 'center'
    });
  } catch (error) {
    doc
      .fillColor('#991b1b')
      .fontSize(10)
      .text('Não foi possível carregar a foto deste item.', contentX, sectionTop + 130);

    doc.fillColor('#111827');
  }

  doc.y = sectionTop + 372;
}

function drawSignaturesBlock(doc, inspection) {
  ensurePageSpace(doc, 200);

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
    width: boxWidth,
    align: 'left'
  });

  doc.text('Assinatura do cliente:', rightX, titleY, {
    width: boxWidth,
    align: 'left'
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

class InspectionController {
  async start(req, res) {
    try {
      const { apartmentId } = req.body;
      const userId = req.user.id;

      if (!apartmentId) {
        return res.status(400).json({ message: 'Apartment ID é obrigatório.' });
      }

      let inspection = await prisma.inspection.findFirst({
        where: {
          apartmentId,
          status: InspectionStatus.EM_ANDAMENTO
        },
        include: {
          items: {
            include: {
              checklistItem: true
            }
          },
          apartment: {
            include: {
              enterprise: true
            }
          },
          user: true
        }
      });

      if (inspection) {
        return res.json(inspection);
      }

      const latestInspection = await prisma.inspection.findFirst({
        where: {
          apartmentId
        },
        include: {
          items: {
            include: {
              checklistItem: true
            }
          },
          apartment: {
            include: {
              enterprise: true
            }
          },
          user: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (latestInspection) {
        const hasPendingItems = latestInspection.items.some(
          (item) => item.status !== ItemStatus.CONFORME
        );

        if (latestInspection.status === InspectionStatus.CONCLUIDA && hasPendingItems) {
          inspection = await prisma.inspection.update({
            where: { id: latestInspection.id },
            data: {
              status: InspectionStatus.EM_ANDAMENTO,
              reopenedFromPending: true,
              userId
            },
            include: {
              items: {
                include: {
                  checklistItem: true
                }
              },
              apartment: {
                include: {
                  enterprise: true
                }
              },
              user: true
            }
          });

          return res.json(inspection);
        }
      }

      inspection = await prisma.inspection.create({
        data: {
          apartmentId,
          userId,
          reopenedFromPending: false
        }
      });

      const checklistItems = await prisma.checklistItem.findMany({
        where: { apartmentId }
      });

      if (checklistItems.length > 0) {
        await prisma.inspectionItem.createMany({
          data: checklistItems.map((item) => ({
            inspectionId: inspection.id,
            checklistItemId: item.id,
            status: ItemStatus.PENDENTE
          }))
        });
      }

      const fullInspection = await prisma.inspection.findUnique({
        where: { id: inspection.id },
        include: {
          apartment: {
            include: {
              enterprise: true
            }
          },
          items: {
            include: {
              checklistItem: true
            }
          },
          user: true
        }
      });

      return res.json(fullInspection);
    } catch (error) {
      console.error('Erro ao iniciar vistoria:', error);
      return res.status(500).json({
        message: 'Erro ao iniciar vistoria.',
        error: error.message
      });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;

      const inspection = await prisma.inspection.findUnique({
        where: { id },
        include: {
          apartment: {
            include: {
              enterprise: true
            }
          },
          items: {
            include: {
              checklistItem: true
            }
          },
          user: true
        }
      });

      if (!inspection) {
        return res.status(404).json({ message: 'Vistoria não encontrada.' });
      }

      return res.json(inspection);
    } catch (error) {
      console.error('Erro ao buscar vistoria:', error);
      return res.status(500).json({
        message: 'Erro ao buscar vistoria.',
        error: error.message
      });
    }
  }

  async updateItem(req, res) {
    try {
      const { itemId } = req.params;
      const { status, notes, photoUrl } = req.body;

      const updated = await prisma.inspectionItem.update({
        where: { id: itemId },
        data: {
          status,
          notes,
          photoUrl
        },
        include: {
          checklistItem: true
        }
      });

      return res.json(updated);
    } catch (error) {
      console.error('Erro ao atualizar item da vistoria:', error);
      return res.status(500).json({
        message: 'Erro ao atualizar item da vistoria.',
        error: error.message
      });
    }
  }

  async updateItemsBatch(req, res) {
    try {
      const { itemIds, status } = req.body;

      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({
          message: 'Informe ao menos um item para atualização em massa.'
        });
      }

      const allowedStatuses = ['PENDENTE', 'CONFORME', 'NAO_CONFORME'];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          message: 'Status inválido para atualização em massa.'
        });
      }

      await prisma.inspectionItem.updateMany({
        where: {
          id: {
            in: itemIds
          }
        },
        data: {
          status
        }
      });

      const updatedItems = await prisma.inspectionItem.findMany({
        where: {
          id: {
            in: itemIds
          }
        },
        include: {
          checklistItem: true
        }
      });

      return res.json({
        message: 'Itens atualizados com sucesso.',
        items: updatedItems
      });
    } catch (error) {
      console.error('Erro ao atualizar itens em massa:', error);
      return res.status(500).json({
        message: 'Erro ao atualizar itens em massa.',
        error: error.message
      });
    }
  }

  async saveSignatures(req, res) {
    try {
      const { id } = req.params;
      const { inspectorSignature, clientSignature } = req.body;

      const inspection = await prisma.inspection.findUnique({
        where: { id }
      });

      if (!inspection) {
        return res.status(404).json({
          message: 'Vistoria não encontrada.'
        });
      }

      const dataToUpdate = {};

      if (inspectorSignature !== undefined) {
        if (
          inspectorSignature &&
          !/^data:image\/[a-zA-Z0-9+.-]+;base64,/.test(inspectorSignature)
        ) {
          return res.status(400).json({
            message: 'Assinatura do vistoriador em formato inválido.'
          });
        }

        dataToUpdate.inspectorSignature = inspectorSignature || null;
      }

      if (clientSignature !== undefined) {
        if (
          clientSignature &&
          !/^data:image\/[a-zA-Z0-9+.-]+;base64,/.test(clientSignature)
        ) {
          return res.status(400).json({
            message: 'Assinatura do cliente em formato inválido.'
          });
        }

        dataToUpdate.clientSignature = clientSignature || null;
      }

      if (Object.keys(dataToUpdate).length === 0) {
        return res.status(400).json({
          message: 'Nenhuma assinatura foi enviada para salvar.'
        });
      }

      const updatedInspection = await prisma.inspection.update({
        where: { id },
        data: dataToUpdate
      });

      return res.json({
        message: 'Assinatura(s) salva(s) com sucesso.',
        inspection: updatedInspection
      });
    } catch (error) {
      console.error('Erro ao salvar assinaturas:', error);
      return res.status(500).json({
        message: 'Erro ao salvar assinaturas.',
        error: error.message
      });
    }
  }

  async finish(req, res) {
    try {
      const { id } = req.params;

      const inspection = await prisma.inspection.findUnique({
        where: { id }
      });

      if (!inspection) {
        return res.status(404).json({
          message: 'Vistoria não encontrada.'
        });
      }

      if (!inspection.inspectorSignature || !inspection.clientSignature) {
        return res.status(400).json({
          message: 'Salve as assinaturas do vistoriador e do cliente antes de finalizar.'
        });
      }

      const finishedInspection = await prisma.inspection.update({
        where: { id },
        data: {
          status: InspectionStatus.CONCLUIDA
        }
      });

      return res.json({
        message: 'Vistoria concluída com sucesso.',
        inspection: finishedInspection
      });
    } catch (error) {
      console.error('Erro ao finalizar vistoria:', error);
      return res.status(500).json({
        message: 'Erro ao finalizar vistoria.',
        error: error.message
      });
    }
  }

  async generateReport(req, res) {
    try {
      const { id } = req.params;

      const inspection = await prisma.inspection.findUnique({
        where: { id },
        include: {
          apartment: {
            include: {
              enterprise: true
            }
          },
          items: {
            include: {
              checklistItem: true
            },
            orderBy: {
              updatedAt: 'asc'
            }
          },
          user: true
        }
      });

      if (!inspection) {
        return res.status(404).json({ message: 'Vistoria não encontrada.' });
      }

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
          await drawItemSection(doc, item);
        }

        doc.y += 4;
      }

      drawSignaturesBlock(doc, inspection);

      doc.end();
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      return res.status(500).json({
        message: 'Erro ao gerar relatório.',
        error: error.message
      });
    }
  }
}

module.exports = new InspectionController();