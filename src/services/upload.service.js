const fs = require('fs');
const { parse } = require('csv-parse/sync');
const prisma = require('../lib/prisma');
const enterpriseRepository = require('../repositories/enterprise.repository');
const apartmentRepository = require('../repositories/apartment.repository');
const checklistItemRepository = require('../repositories/checklist-item.repository');
const { ValidationError } = require('../errors/http-errors');

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return Number.NaN;

  const raw = String(value).trim();

  if (/^\d+[.,]?\d*$/.test(raw)) {
    return Number(raw.replace(',', '.'));
  }

  return Number.NaN;
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

class UploadService {
  uploadFile(req) {
    if (!req.file) {
      throw new ValidationError('Arquivo não enviado.');
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    return {
      message: 'Arquivo enviado com sucesso.',
      fileUrl
    };
  }

  async importChecklistCsv(req) {
    if (!req.file) {
      throw new ValidationError('Arquivo CSV não enviado.');
    }

    try {
      const fileBuffer = fs.readFileSync(req.file.path);
      const { records, encoding, delimiter } = parseCsvContent(fileBuffer);

      if (!records.length) {
        throw new ValidationError('O CSV está vazio.');
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
        const item = normalizeText(getField(row, ['ITEM', 'item', 'Item']));
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
        throw new ValidationError('Nenhuma linha válida foi encontrada no CSV.', {
          totalLinhasProcessadas: records.length,
          totalLinhasIgnoradas
        });
      }

      const result = await prisma.$transaction(async (db) => {
        const uniqueEnterpriseNames = [...new Set(normalizedRows.map((row) => row.empreendimento))];
        const existingEnterprises = await enterpriseRepository.findManyByNames(uniqueEnterpriseNames, db);
        const enterpriseMap = new Map(existingEnterprises.map((enterprise) => [enterprise.name, enterprise]));

        let totalEnterprisesCreated = 0;
        let totalApartmentsCreated = 0;
        let totalItemsCreated = 0;

        for (const enterpriseName of uniqueEnterpriseNames) {
          if (!enterpriseMap.has(enterpriseName)) {
            const createdEnterprise = await enterpriseRepository.create({ name: enterpriseName }, db);
            enterpriseMap.set(enterpriseName, createdEnterprise);
            totalEnterprisesCreated++;
          }
        }

        const allApartments = await apartmentRepository.findAllWithEnterprise(db);
        const apartmentMap = new Map(
          allApartments.map((apartment) => [`${apartment.enterprise.name}|||${apartment.number}`, apartment])
        );

        const uniqueApartments = new Map();

        for (const row of normalizedRows) {
          const key = `${row.empreendimento}|||${row.apartamento}`;
          if (!uniqueApartments.has(key)) {
            uniqueApartments.set(key, row);
          }
        }

        for (const row of uniqueApartments.values()) {
          const apartmentKey = `${row.empreendimento}|||${row.apartamento}`;

          if (!apartmentMap.has(apartmentKey)) {
            const enterprise = enterpriseMap.get(row.empreendimento);
            const createdApartment = await apartmentRepository.create(
              {
                number: row.apartamento,
                enterpriseId: enterprise.id
              },
              db
            );

            apartmentMap.set(apartmentKey, createdApartment);
            totalApartmentsCreated++;
          }
        }

        const allChecklistItems = await checklistItemRepository.findAllWithApartmentAndEnterprise(db);
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
          await checklistItemRepository.createMany(itemsToCreate, db);
          totalItemsCreated = itemsToCreate.length;
        }

        return {
          totalEnterprisesCreated,
          totalApartmentsCreated,
          totalItemsCreated
        };
      });

      return {
        message: 'Importação concluída com sucesso.',
        totalLinhasProcessadas: records.length,
        totalEmpreendimentosCriados: result.totalEnterprisesCreated,
        totalApartamentosCriados: result.totalApartmentsCreated,
        totalItensCriados: result.totalItemsCreated,
        totalLinhasIgnoradas,
        encodingUsado: encoding,
        delimitadorUsado: delimiter
      };
    } finally {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
  }
}

module.exports = new UploadService();
