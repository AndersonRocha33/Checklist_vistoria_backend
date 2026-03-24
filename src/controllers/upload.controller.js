const fs = require('fs');
const { parse } = require('csv-parse/sync');
const prisma = require('../lib/prisma');

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return NaN;

  const raw = String(value).trim();

  if (/^\d+[.,]?\d*$/.test(raw)) {
    return Number(raw.replace(',', '.'));
  }

  return NaN;
}

function getField(row, possibleKeys) {
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key];
    }
  }
  return '';
}

function parseCsvContent(fileBuffer) {
  const attempts = [
    { encoding: 'utf-8', delimiter: ',' },
    { encoding: 'latin1', delimiter: ',' },
    { encoding: 'utf-8', delimiter: ';' },
    { encoding: 'latin1', delimiter: ';' }
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const content = fileBuffer.toString(attempt.encoding);

      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        delimiter: attempt.delimiter,
        relax_column_count: true
      });

      if (records && records.length > 0) {
        return {
          records,
          encoding: attempt.encoding,
          delimiter: attempt.delimiter
        };
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Não foi possível ler o CSV.');
}

class UploadController {
  async uploadFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Arquivo não enviado.' });
      }

      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

      return res.json({
        message: 'Arquivo enviado com sucesso.',
        fileUrl
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao fazer upload.' });
    }
  }

  async importChecklistCsv(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Arquivo CSV não enviado.' });
      }

      const fileBuffer = fs.readFileSync(req.file.path);
      const { records, encoding, delimiter } = parseCsvContent(fileBuffer);

      if (!records.length) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'O CSV está vazio.' });
      }

      const normalizedRows = [];
      let totalLinhasIgnoradas = 0;

      for (const row of records) {
        const empreendimento = normalizeText(
          getField(row, ['EMPREENDIMENTO', 'empreendimento', 'Empreendimento'])
        );

        const apartamento = normalizeText(
          getField(row, ['UH', 'uh', 'APARTAMENTO', 'apartamento', 'Apartamento'])
        );

        const localizacao = normalizeText(
          getField(row, [
            'LOCALIZAÇÃO',
            'LOCALIZACAO',
            'localizacao',
            'Localização',
            'Localizacao'
          ])
        );

        const item = normalizeText(
          getField(row, ['ITEM', 'item', 'Item'])
        );

        const quantidade = normalizeNumber(
          getField(row, ['QTDE', 'QUANTIDADE', 'quantidade', 'Qtde', 'Quantidade'])
        );

        if (!empreendimento || !apartamento || !localizacao || !item || Number.isNaN(quantidade)) {
          totalLinhasIgnoradas++;
          continue;
        }

        normalizedRows.push({
          empreendimento,
          apartamento,
          localizacao,
          item,
          quantidade: Math.round(quantidade)
        });
      }

      if (!normalizedRows.length) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          message: 'Nenhuma linha válida foi encontrada no CSV.',
          totalLinhasProcessadas: records.length,
          totalLinhasIgnoradas
        });
      }

      const uniqueEnterpriseNames = [...new Set(normalizedRows.map((row) => row.empreendimento))];

      const existingEnterprises = await prisma.enterprise.findMany({
        where: {
          name: {
            in: uniqueEnterpriseNames
          }
        }
      });

      const enterpriseMap = new Map(existingEnterprises.map((e) => [e.name, e]));

      let totalEnterprisesCreated = 0;
      let totalApartmentsCreated = 0;
      let totalItemsCreated = 0;

      for (const enterpriseName of uniqueEnterpriseNames) {
        if (!enterpriseMap.has(enterpriseName)) {
          const createdEnterprise = await prisma.enterprise.create({
            data: { name: enterpriseName }
          });

          enterpriseMap.set(enterpriseName, createdEnterprise);
          totalEnterprisesCreated++;
        }
      }

      const allApartments = await prisma.apartment.findMany({
        include: {
          enterprise: true
        }
      });

      const apartmentMap = new Map(
        allApartments.map((a) => [`${a.enterprise.name}|||${a.number}`, a])
      );

      const uniqueApartments = new Map();

      for (const row of normalizedRows) {
        const key = `${row.empreendimento}|||${row.apartamento}`;
        if (!uniqueApartments.has(key)) {
          uniqueApartments.set(key, row);
        }
      }

      for (const [, row] of uniqueApartments) {
        const apartmentKey = `${row.empreendimento}|||${row.apartamento}`;

        if (!apartmentMap.has(apartmentKey)) {
          const enterprise = enterpriseMap.get(row.empreendimento);

          const createdApartment = await prisma.apartment.create({
            data: {
              number: row.apartamento,
              enterpriseId: enterprise.id
            },
            include: {
              enterprise: true
            }
          });

          apartmentMap.set(apartmentKey, createdApartment);
          totalApartmentsCreated++;
        }
      }

      const allChecklistItems = await prisma.checklistItem.findMany({
        include: {
          apartment: {
            include: {
              enterprise: true
            }
          }
        }
      });

      const checklistItemMap = new Set(
        allChecklistItems.map(
          (item) =>
            `${item.apartment.enterprise.name}|||${item.apartment.number}|||${item.location}|||${item.itemName}`
        )
      );

      const itemsToCreate = [];

      for (const row of normalizedRows) {
        const apartmentKey = `${row.empreendimento}|||${row.apartamento}`;
        const apartment = apartmentMap.get(apartmentKey);

        const itemKey = `${row.empreendimento}|||${row.apartamento}|||${row.localizacao}|||${row.item}`;

        if (!checklistItemMap.has(itemKey)) {
          itemsToCreate.push({
            apartmentId: apartment.id,
            location: row.localizacao,
            itemName: row.item,
            quantity: row.quantidade
          });

          checklistItemMap.add(itemKey);
        }
      }

      if (itemsToCreate.length > 0) {
        await prisma.checklistItem.createMany({
          data: itemsToCreate
        });

        totalItemsCreated = itemsToCreate.length;
      }

      fs.unlinkSync(req.file.path);

      return res.json({
        message: 'Importação concluída com sucesso.',
        totalLinhasProcessadas: records.length,
        totalEmpreendimentosCriados: totalEnterprisesCreated,
        totalApartamentosCriados: totalApartmentsCreated,
        totalItensCriados: totalItemsCreated,
        totalLinhasIgnoradas,
        encodingUsado: encoding,
        delimitadorUsado: delimiter
      });
    } catch (error) {
      console.error('Erro ao importar CSV:', error);

      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(500).json({
        message: 'Erro ao importar CSV.',
        error: error.message
      });
    }
  }
}

module.exports = new UploadController();