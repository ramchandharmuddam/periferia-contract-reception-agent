import {
  access,
  copyFile,
  mkdir,
  readdir,
  readFile,
  writeFile
} from "node:fs/promises";

import path from "node:path";

import {
  parse
} from "csv-parse/sync";

import {
  stringify
} from "csv-stringify/sync";

import {
  z
} from "zod";

import type {
  Correo
} from "../types/correo.js";

import type {
  ExtractedContract,
  DocumentType,
  Country,
  Currency
} from "../types/contrato.js";

type ToolContext = {
  directory: string;
  sessionId: string;
};

type MasterContractRow = {
  id_contrato: string;
  cliente: string;
  nit_cliente: string;
  pais: string;
  objeto: string;
  valor: string;
  moneda: string;
  fecha_inicio: string;
  fecha_fin: string;
  requiere_poliza: string;
  tipo_poliza: string;
  estado_poliza: string;
  comercial: string;
  ruta_sharepoint: string;
  fecha_registro: string;
  fuente: string;
};

type SalesRepresentative = {
  email: string;
  nombre: string;
  region: string;
};

type ValidationResult = {
  clasificacion:
    | "nuevo"
    | "actualizacion"
    | "duplicado"
    | "rechazado";

  requiere_revision: string[];

  id_contrato_existente?: string;

  motivo?: string;

  diferencias?: Record<
    string,
    {
      previous:
        | string
        | number
        | boolean
        | null;

      new:
        | string
        | number
        | boolean
        | null;
    }
  >;

  comercial?: {
    email: string;
    encontrado: boolean;
    nombre: string | null;
    region: string | null;
  };

  valor_normalizado?:
    number | null;
};

type ContractAlert = {
  id_contrato: string;
  cliente: string;
  fecha_fin: string;
  requiere_poliza: boolean;
  estado_poliza: string;
  dias_para_vencimiento: number | null;
  razones: string[];
};

// =====================================================
// PATH HELPERS
// =====================================================

function getInboxPath(
  directory: string
): string {
  return path.join(
    directory,
    "fixtures",
    "reto-02",
    "buzon"
  );
}

function getFixtureMasterPath(
  directory: string
): string {
  return path.join(
    directory,
    "fixtures",
    "reto-02",
    "maestro-contratos.csv"
  );
}

function getOutPath(
  directory: string
): string {
  return path.join(
    directory,
    "out"
  );
}

function getSharePointPath(
  directory: string
): string {
  return path.join(
    getOutPath(
      directory
    ),
    "sharepoint"
  );
}

function getOutputMasterPath(
  directory: string
): string {
  return path.join(
    getSharePointPath(
      directory
    ),
    "maestro-contratos.csv"
  );
}

function getDocumentsPath(
  directory: string
): string {
  return path.join(
    getSharePointPath(
      directory
    ),
    "documentos"
  );
}

function getHistoryPath(
  directory: string
): string {
  return path.join(
    getSharePointPath(
      directory
    ),
    "historial.json"
  );
}

function getAlertsPath(
  directory: string
): string {
  return path.join(
    getSharePointPath(
      directory
    ),
    "alertas.json"
  );
}

function getProcessedPath(
  directory: string
): string {
  return path.join(
    getOutPath(
      directory
    ),
    "procesados.json"
  );
}

function getSalesCatalogPath(
  directory: string
): string {
  return path.join(
    directory,
    "fixtures",
    "reto-02",
    "comerciales.json"
  );
}

async function fileExists(
  filePath: string
): Promise<boolean> {
  try {
    await access(
      filePath
    );

    return true;
  } catch {
    return false;
  }
}

async function ensureOutputFolders(
  directory: string
): Promise<void> {
  await mkdir(
    getSharePointPath(
      directory
    ),
    {
      recursive: true
    }
  );

  await mkdir(
    getDocumentsPath(
      directory
    ),
    {
      recursive: true
    }
  );
}

// =====================================================
// GENERAL HELPERS
// =====================================================

function normalizeText(
  text: string
): string {
  return text
    .toLowerCase()
    .normalize(
      "NFD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

function normalizeComparisonText(
  text: string
): string {
  return normalizeText(
    text
  )
    .replace(
      /[^a-z0-9\s]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function getDateFromEmail(
  email: Correo
): string {
  return email.fecha.slice(
    0,
    10
  );
}

function parseIsoDate(
  value: string
): Date | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return null;
  }

  const date =
    new Date(
      `${value}T00:00:00.000Z`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

function daysBetween(
  start: Date,
  end: Date
): number {
  const millisecondsPerDay =
    24 *
    60 *
    60 *
    1000;

  return Math.round(
    (
      end.getTime() -
      start.getTime()
    ) /
      millisecondsPerDay
  );
}

// =====================================================
// INBOX
// =====================================================

export async function readInbox(
  directory =
    process.cwd()
): Promise<Correo[]> {
  const folders =
    await readdir(
      getInboxPath(
        directory
      ),
      {
        withFileTypes: true
      }
    );

  const messages:
    Correo[] = [];

  for (
    const folder
    of folders
  ) {
    if (
      !folder.isDirectory()
    ) {
      continue;
    }

    const emailPath =
      path.join(
        getInboxPath(
          directory
        ),
        folder.name,
        "correo.json"
      );

    const content =
      await readFile(
        emailPath,
        "utf-8"
      );

    messages.push(
      JSON.parse(
        content
      ) as Correo
    );
  }

  messages.sort(
    (a, b) =>
      a.id.localeCompare(
        b.id
      )
  );

  return messages;
}

async function loadEmail(
  messageId: string,
  directory: string
): Promise<Correo> {
  const filePath =
    path.join(
      getInboxPath(
        directory
      ),
      messageId,
      "correo.json"
    );

  const content =
    await readFile(
      filePath,
      "utf-8"
    );

  return JSON.parse(
    content
  ) as Correo;
}

// =====================================================
// EXTRACTION HELPERS
// =====================================================

function detectDocumentType(
  fileName: string,
  content: string
): DocumentType {
  const name =
    fileName.toLowerCase();

  const text =
    content.toLowerCase();

  if (
    name.includes(
      "otrosi"
    ) ||
    text.includes(
      "otrosí"
    ) ||
    text.includes(
      "otrosi"
    )
  ) {
    return "otrosi";
  }

  if (
    name.includes(
      "cotizacion"
    ) ||
    text.includes(
      "cotización"
    ) ||
    text.includes(
      "cotizacion"
    )
  ) {
    return "cotizacion";
  }

  if (
    name.includes(
      "contrato"
    ) ||
    text.includes(
      "contrato"
    )
  ) {
    return "contrato";
  }

  return "desconocido";
}

function extractContractId(
  content: string
): {
  valor: string | null;
  confianza: number;
} {
  const match =
    content.match(
      /\b((?:CT|CM)-\d{4}-\d{1,4})\b/i
    );

  if (
    match?.[1]
  ) {
    return {
      valor:
        match[1]
          .toUpperCase(),

      confianza:
        0.99
    };
  }

  return {
    valor: null,
    confianza: 0
  };
}

function getClientSection(
  content: string
): string {
  const parts =
    content.split(
      /(?:,\s*y\s+PERIFERIA IT GROUP|,\s*PERIFERIA IT GROUP)/i
    );

  return (
    parts[0] ??
    content
  );
}

function extractClient(
  content: string
): {
  valor: string | null;
  confianza: number;
} {
  const section =
    getClientSection(
      content
    );

  const patterns = [
    /Entre los suscritos,\s*([^,\n]+)/i,
    /Entre\s+([^,\n]+)/i,
    /Cliente:\s*([^\n]+)/i
  ];

  for (
    const pattern
    of patterns
  ) {
    const match =
      section.match(
        pattern
      );

    if (
      match?.[1]
    ) {
      return {
        valor:
          match[1]
            .trim(),

        confianza:
          0.95
      };
    }
  }

  return {
    valor: null,
    confianza: 0
  };
}

function normalizeTaxId(
  type: string,
  value: string
): string {
  const digits =
    value.replace(
      /\D/g,
      ""
    );

  if (
    type.toUpperCase() ===
      "NIT" &&
    digits.length > 1
  ) {
    return digits.slice(
      0,
      -1
    );
  }

  return digits;
}

function extractTaxId(
  content: string
): {
  valor: string | null;
  confianza: number;
  type:
    | "NIT"
    | "RUC"
    | "RTN"
    | null;
} {
  const section =
    getClientSection(
      content
    );

  const match =
    section.match(
      /\b(NIT|RUC|RTN)\s+([0-9.\-]+)/i
    );

  if (
    match?.[1] &&
    match?.[2]
  ) {
    const type =
      match[1]
        .toUpperCase() as
        | "NIT"
        | "RUC"
        | "RTN";

    return {
      valor:
        normalizeTaxId(
          type,
          match[2]
        ),

      confianza:
        0.98,

      type
    };
  }

  return {
    valor: null,
    confianza: 0,
    type: null
  };
}

function extractCountry(
  content: string,
  taxType:
    | "NIT"
    | "RUC"
    | "RTN"
    | null
): {
  valor: Country | null;
  confianza: number;
} {
  const text =
    getClientSection(
      content
    )
      .toLowerCase();

  if (
    text.includes(
      "ecuador"
    )
  ) {
    return {
      valor: "EC",
      confianza: 0.98
    };
  }

  if (
    text.includes(
      "perú"
    ) ||
    text.includes(
      "peru"
    )
  ) {
    return {
      valor: "PE",
      confianza: 0.98
    };
  }

  if (
    text.includes(
      "panamá"
    ) ||
    text.includes(
      "panama"
    )
  ) {
    return {
      valor: "PA",
      confianza: 0.98
    };
  }

  if (
    text.includes(
      "honduras"
    )
  ) {
    return {
      valor: "HN",
      confianza: 0.98
    };
  }

  if (
    text.includes(
      "colombia"
    )
  ) {
    return {
      valor: "CO",
      confianza: 0.98
    };
  }

  if (
    taxType ===
    "NIT"
  ) {
    return {
      valor: "CO",
      confianza: 0.9
    };
  }

  return {
    valor: null,
    confianza: 0
  };
}

function extractObject(
  content: string
): {
  valor: string | null;
  confianza: number;
} {
  const patterns = [
    /PRIMERA\.\s*OBJETO\.\s*([\s\S]*?)(?=\n\s*SEGUNDA\.)/i,
    /Descripción:\s*([^\n]+)/i
  ];

  for (
    const pattern
    of patterns
  ) {
    const match =
      content.match(
        pattern
      );

    if (
      match?.[1]
    ) {
      return {
        valor:
          match[1]
            .replace(
              /\s+/g,
              " "
            )
            .trim(),

        confianza:
          0.95
      };
    }
  }

  return {
    valor: null,
    confianza: 0
  };
}

function extractCurrency(
  content: string
): {
  valor: Currency | null;
  confianza: number;
} {
  const text =
    content.toUpperCase();

  const currencies:
    Currency[] = [
      "USD",
      "PEN",
      "COP",
      "HNL",
      "PAB"
    ];

  for (
    const currency
    of currencies
  ) {
    if (
      text.includes(
        currency
      )
    ) {
      return {
        valor:
          currency,

        confianza:
          0.99
      };
    }
  }

  return {
    valor: null,
    confianza: 0
  };
}

function extractIndeterminateValue(
  content: string
): {
  valor: boolean;
  confianza: number;
} {
  if (
    content
      .toLowerCase()
      .includes(
        "no tiene un valor determinado"
      )
  ) {
    return {
      valor: true,
      confianza: 0.99
    };
  }

  return {
    valor: false,
    confianza: 0.95
  };
}

function parseAmount(
  amount: string
): number | null {
  let normalized =
    amount
      .replace(
        /\$/g,
        ""
      )
      .replace(
        /\s/g,
        ""
      );

  const hasPeriod =
    normalized.includes(
      "."
    );

  const hasComma =
    normalized.includes(
      ","
    );

  if (
    hasPeriod &&
    hasComma
  ) {
    if (
      normalized
        .lastIndexOf(
          "."
        ) >
      normalized
        .lastIndexOf(
          ","
        )
    ) {
      normalized =
        normalized.replace(
          /,/g,
          ""
        );
    } else {
      normalized =
        normalized
          .replace(
            /\./g,
            ""
          )
          .replace(
            ",",
            "."
          );
    }
  } else if (
    hasPeriod
  ) {
    const parts =
      normalized.split(
        "."
      );

    if (
      parts.length > 2 ||
      parts.at(-1)
        ?.length === 3
    ) {
      normalized =
        normalized.replace(
          /\./g,
          ""
        );
    }
  } else if (
    hasComma
  ) {
    const parts =
      normalized.split(
        ","
      );

    if (
      parts.at(-1)
        ?.length === 3
    ) {
      normalized =
        normalized.replace(
          /,/g,
          ""
        );
    } else {
      normalized =
        normalized.replace(
          ",",
          "."
        );
    }
  }

  const value =
    Number.parseFloat(
      normalized
    );

  return Number.isNaN(
    value
  )
    ? null
    : value;
}

function extractValue(
  content: string,
  documentType:
    DocumentType,
  indeterminate:
    boolean
): {
  valor: number | null;
  confianza: number;
} {
  if (
    indeterminate
  ) {
    return {
      valor: null,
      confianza: 0.99
    };
  }

  if (
    documentType ===
    "cotizacion"
  ) {
    const total =
      content.match(
        /Valor total estimado:\s*(?:COP|USD|PEN|HNL|PAB)\s*\$?\s*([\d.,]+)/i
      );

    if (
      total?.[1]
    ) {
      const value =
        parseAmount(
          total[1]
        );

      if (
        value !== null
      ) {
        return {
          valor: value,
          confianza: 0.98
        };
      }
    }
  }

  const block =
    content.match(
      /SEGUNDA\.\s*(?:VALOR\.)?([\s\S]*?)(?=\n\s*TERCERA\.)/i
    );

  const valueText =
    block?.[1] ??
    content;

  const match =
    valueText.match(
      /\b(?:COP|USD|PEN|HNL|PAB)\s*\$?\s*([\d.,]+)/i
    );

  if (
    match?.[1]
  ) {
    const value =
      parseAmount(
        match[1]
      );

    if (
      value !== null
    ) {
      return {
        valor: value,
        confianza: 0.98
      };
    }
  }

  return {
    valor: null,
    confianza: 0
  };
}

// =====================================================
// DATE EXTRACTION
// =====================================================

const MONTHS:
  Record<
    string,
    number
  > = {
    enero: 1,
    febrero: 2,
    marzo: 3,
    abril: 4,
    mayo: 5,
    junio: 6,
    julio: 7,
    agosto: 8,
    septiembre: 9,
    setiembre: 9,
    octubre: 10,
    noviembre: 11,
    diciembre: 12
  };

function formatDate(
  year: number,
  month: number,
  day: number
): string {
  return (
    `${year}-` +
    `${String(month)
      .padStart(
        2,
        "0"
      )}-` +
    `${String(day)
      .padStart(
        2,
        "0"
      )}`
  );
}

function convertWrittenDate(
  dayText: string,
  monthText: string,
  yearText: string
): string | null {
  const day =
    Number.parseInt(
      dayText,
      10
    );

  const month =
    MONTHS[
      normalizeText(
        monthText
      )
    ];

  const year =
    Number.parseInt(
      yearText,
      10
    );

  if (
    !day ||
    !month ||
    !year
  ) {
    return null;
  }

  return formatDate(
    year,
    month,
    day
  );
}

function extractStartDate(
  content: string
): {
  valor: string | null;
  confianza: number;
} {
  const match =
    content.match(
      /desde el\s+[a-záéíóúñ\s-]+\((\d{1,2})\)\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i
    );

  if (
    match?.[1] &&
    match?.[2] &&
    match?.[3]
  ) {
    const date =
      convertWrittenDate(
        match[1],
        match[2],
        match[3]
      );

    if (
      date
    ) {
      return {
        valor: date,
        confianza: 0.99
      };
    }
  }

  return {
    valor: null,
    confianza: 0
  };
}

function extractEndDate(
  content: string,
  documentType:
    DocumentType
): {
  valor: string | null;
  confianza: number;
} {
  const explicit =
    content.match(
      /hasta el\s+[a-záéíóúñ\s-]+\((\d{1,2})\)\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i
    );

  if (
    explicit?.[1] &&
    explicit?.[2] &&
    explicit?.[3]
  ) {
    const date =
      convertWrittenDate(
        explicit[1],
        explicit[2],
        explicit[3]
      );

    if (
      date
    ) {
      return {
        valor: date,
        confianza: 0.99
      };
    }
  }

  if (
    documentType ===
    "otrosi"
  ) {
    const extension =
      content.match(
        /se extiende hasta el\s+[a-záéíóúñ\s-]+\((\d{1,2})\)\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i
      );

    if (
      extension?.[1] &&
      extension?.[2] &&
      extension?.[3]
    ) {
      const date =
        convertWrittenDate(
          extension[1],
          extension[2],
          extension[3]
        );

      if (
        date
      ) {
        return {
          valor: date,
          confianza: 0.99
        };
      }
    }
  }

  const duration =
    content.match(
      /duración de\s+[a-záéíóúñ\s-]+\((\d{1,2})\)\s+meses/i
    );

  const signingMonth =
    content.match(
      /se firma[\s\S]*?mes de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i
    );

  if (
    duration?.[1] &&
    signingMonth?.[1] &&
    signingMonth?.[2]
  ) {
    const months =
      Number.parseInt(
        duration[1],
        10
      );

    const startMonth =
      MONTHS[
        normalizeText(
          signingMonth[1]
        )
      ];

    const startYear =
      Number.parseInt(
        signingMonth[2],
        10
      );

    if (
      startMonth &&
      startYear &&
      months > 0
    ) {
      const total =
        startMonth -
        1 +
        months;

      const endYear =
        startYear +
        Math.floor(
          total /
          12
        );

      const endMonth =
        (
          total %
          12
        ) + 1;

      const lastDay =
        new Date(
          Date.UTC(
            endYear,
            endMonth,
            0
          )
        )
          .getUTCDate();

      return {
        valor:
          formatDate(
            endYear,
            endMonth,
            lastDay
          ),

        confianza:
          0.65
      };
    }
  }

  return {
    valor: null,
    confianza: 0
  };
}

// =====================================================
// POLICY EXTRACTION
// =====================================================

function extractRequiresPolicy(
  content: string,
  emailBody: string,
  documentType:
    DocumentType
): {
  valor: boolean | null;
  confianza: number;
} {
  if (
    documentType ===
    "cotizacion"
  ) {
    return {
      valor: null,
      confianza: 0
    };
  }

  const text =
    `${content}\n${emailBody}`
      .toLowerCase();

  const negatives = [
    "no requiere póliza",
    "no requiere poliza",
    "no pide póliza",
    "no pide poliza",
    "sin póliza",
    "sin poliza"
  ];

  if (
    negatives.some(
      (phrase) =>
        text.includes(
          phrase
        )
    )
  ) {
    return {
      valor: false,
      confianza: 0.99
    };
  }

  const positives = [
    "póliza",
    "poliza",
    "garantías",
    "garantias",
    "garantía",
    "garantia"
  ];

  if (
    positives.some(
      (phrase) =>
        text.includes(
          phrase
        )
    )
  ) {
    return {
      valor: true,
      confianza: 0.95
    };
  }

  return {
    valor: null,
    confianza: 0
  };
}

function extractPolicyType(
  content: string,
  requiresPolicy:
    boolean | null
): {
  valor: string | null;
  confianza: number;
} {
  if (
    requiresPolicy ===
    false
  ) {
    return {
      valor: null,
      confianza: 0.99
    };
  }

  if (
    requiresPolicy !==
    true
  ) {
    return {
      valor: null,
      confianza: 0
    };
  }

  const text =
    content.toLowerCase();

  const types:
    string[] = [];

  if (
    text.includes(
      "cumplimiento"
    )
  ) {
    types.push(
      "cumplimiento"
    );
  }

  if (
    text.includes(
      "responsabilidad civil"
    )
  ) {
    types.push(
      "responsabilidad_civil"
    );
  }

  if (
    text.includes(
      "calidad"
    )
  ) {
    types.push(
      "calidad"
    );
  }

  if (
    text.includes(
      "salarios y prestaciones"
    )
  ) {
    types.push(
      "salarios_prestaciones"
    );
  }

  if (
    types.length >
    0
  ) {
    return {
      valor:
        types.join(
          ";"
        ),

      confianza:
        0.92
    };
  }

  return {
    valor:
      "no_especificada",

    confianza:
      0.7
  };
}

// =====================================================
// MAIN EXTRACTION
// =====================================================

export async function extractContract(
  messageId: string,
  directory =
    process.cwd()
): Promise<ExtractedContract> {
  const messagePath =
    path.join(
      getInboxPath(
        directory
      ),
      messageId
    );

  const files =
    await readdir(
      messagePath
    );

  const attachment =
    files.find(
      (file) =>
        file
          .toLowerCase()
          .endsWith(
            ".txt"
          )
    );

  if (
    !attachment
  ) {
    throw new Error(
      `No text attachment found for ${messageId}`
    );
  }

  const content =
    await readFile(
      path.join(
        messagePath,
        attachment
      ),
      "utf-8"
    );

  const email =
    await loadEmail(
      messageId,
      directory
    );

  const documentType =
    detectDocumentType(
      attachment,
      content
    );

  const taxId =
    extractTaxId(
      content
    );

  const indeterminateValue =
    extractIndeterminateValue(
      content
    );

  const requiresPolicy =
    extractRequiresPolicy(
      content,
      email.cuerpo,
      documentType
    );

  return {
    mensaje_id:
      messageId,

    tipo_documento:
      documentType,

    id_contrato:
      extractContractId(
        content
      ),

    cliente:
      extractClient(
        content
      ),

    nit_cliente: {
      valor:
        taxId.valor,

      confianza:
        taxId.confianza
    },

    pais:
      extractCountry(
        content,
        taxId.type
      ),

    objeto:
      extractObject(
        content
      ),

    valor:
      extractValue(
        content,
        documentType,
        indeterminateValue.valor
      ),

    valor_indeterminado:
      indeterminateValue,

    moneda:
      extractCurrency(
        content
      ),

    fecha_inicio:
      extractStartDate(
        content
      ),

    fecha_fin:
      extractEndDate(
        content,
        documentType
      ),

    requiere_poliza:
      requiresPolicy,

    tipo_poliza:
      extractPolicyType(
        content,
        requiresPolicy.valor
      )
  };
}

// =====================================================
// ZOD SCHEMAS
// =====================================================

const confidenceSchema =
  z
    .number()
    .min(0)
    .max(1);

const stringFieldSchema =
  z.object({
    valor:
      z
        .string()
        .nullable(),

    confianza:
      confidenceSchema
  });

const numberFieldSchema =
  z.object({
    valor:
      z
        .number()
        .nullable(),

    confianza:
      confidenceSchema
  });

const booleanFieldSchema =
  z.object({
    valor:
      z
        .boolean()
        .nullable(),

    confianza:
      confidenceSchema
  });

const countryFieldSchema =
  z.object({
    valor:
      z
        .enum([
          "CO",
          "EC",
          "PE",
          "PA",
          "HN"
        ])
        .nullable(),

    confianza:
      confidenceSchema
  });

const currencyFieldSchema =
  z.object({
    valor:
      z
        .enum([
          "COP",
          "USD",
          "PEN",
          "PAB",
          "HNL"
        ])
        .nullable(),

    confianza:
      confidenceSchema
  });

const extractedContractSchema =
  z.object({
    mensaje_id:
      z.string(),

    tipo_documento:
      z.enum([
        "contrato",
        "otrosi",
        "cotizacion",
        "desconocido"
      ]),

    id_contrato:
      stringFieldSchema,

    cliente:
      stringFieldSchema,

    nit_cliente:
      stringFieldSchema,

    pais:
      countryFieldSchema,

    objeto:
      stringFieldSchema,

    valor:
      numberFieldSchema,

    valor_indeterminado:
      booleanFieldSchema,

    moneda:
      currencyFieldSchema,

    fecha_inicio:
      stringFieldSchema,

    fecha_fin:
      stringFieldSchema,

    requiere_poliza:
      booleanFieldSchema,

    tipo_poliza:
      stringFieldSchema
  });

type ValidatableContract =
  z.infer<
    typeof extractedContractSchema
  >;

const validationResultSchema =
  z.object({
    clasificacion:
      z.enum([
        "nuevo",
        "actualizacion",
        "duplicado",
        "rechazado"
      ]),

    requiere_revision:
      z.array(
        z.string()
      ),

    id_contrato_existente:
      z
        .string()
        .optional(),

    motivo:
      z
        .string()
        .optional(),

    diferencias:
      z
        .record(
          z.string(),
          z.object({
            previous:
              z.union([
                z.string(),
                z.number(),
                z.boolean(),
                z.null()
              ]),

            new:
              z.union([
                z.string(),
                z.number(),
                z.boolean(),
                z.null()
              ])
          })
        )
        .optional(),

    comercial:
      z
        .object({
          email:
            z.string(),

          encontrado:
            z.boolean(),

          nombre:
            z
              .string()
              .nullable(),

          region:
            z
              .string()
              .nullable()
        })
        .optional(),

    valor_normalizado:
      z
        .number()
        .nullable()
        .optional()
  });

// =====================================================
// MASTER / CATALOG
// =====================================================

async function loadMaster(
  directory: string
): Promise<
  MasterContractRow[]
> {
  const outputPath =
    getOutputMasterPath(
      directory
    );

  const sourcePath =
    await fileExists(
      outputPath
    )
      ? outputPath
      : getFixtureMasterPath(
          directory
        );

  const content =
    await readFile(
      sourcePath,
      "utf-8"
    );

  return parse(
    content,
    {
      columns: true,
      skip_empty_lines:
        true,
      trim: true
    }
  ) as MasterContractRow[];
}

async function saveMaster(
  directory: string,
  rows:
    MasterContractRow[]
): Promise<void> {
  await ensureOutputFolders(
    directory
  );

  const csv =
    stringify(
      rows,
      {
        header: true,

        columns: [
          "id_contrato",
          "cliente",
          "nit_cliente",
          "pais",
          "objeto",
          "valor",
          "moneda",
          "fecha_inicio",
          "fecha_fin",
          "requiere_poliza",
          "tipo_poliza",
          "estado_poliza",
          "comercial",
          "ruta_sharepoint",
          "fecha_registro",
          "fuente"
        ]
      }
    );

  await writeFile(
    getOutputMasterPath(
      directory
    ),
    csv,
    "utf-8"
  );
}

async function loadSalesRepresentatives(
  directory: string
): Promise<
  SalesRepresentative[]
> {
  const parsed =
    JSON.parse(
      await readFile(
        getSalesCatalogPath(
          directory
        ),
        "utf-8"
      )
    );

  if (
    !Array.isArray(
      parsed
    )
  ) {
    throw new Error(
      "comerciales.json must contain an array"
    );
  }

  return parsed as
    SalesRepresentative[];
}

// =====================================================
// VALIDATION
// =====================================================

function levenshteinDistance(
  first: string,
  second: string
): number {
  const matrix =
    Array.from(
      {
        length:
          first.length +
          1
      },
      () =>
        Array(
          second.length +
          1
        )
          .fill(
            0
          )
    ) as number[][];

  for (
    let i = 0;
    i <= first.length;
    i++
  ) {
    matrix[i]![0] =
      i;
  }

  for (
    let j = 0;
    j <= second.length;
    j++
  ) {
    matrix[0]![j] =
      j;
  }

  for (
    let i = 1;
    i <= first.length;
    i++
  ) {
    for (
      let j = 1;
      j <= second.length;
      j++
    ) {
      const cost =
        first[
          i - 1
        ] ===
        second[
          j - 1
        ]
          ? 0
          : 1;

      matrix[i]![j] =
        Math.min(
          matrix[
            i - 1
          ]![j]! +
            1,

          matrix[i]![
            j - 1
          ]! +
            1,

          matrix[
            i - 1
          ]![
            j - 1
          ]! +
            cost
        );
    }
  }

  return matrix[
    first.length
  ]![
    second.length
  ]!;
}

function textSimilarity(
  first: string,
  second: string
): number {
  const a =
    normalizeComparisonText(
      first
    );

  const b =
    normalizeComparisonText(
      second
    );

  if (
    !a ||
    !b
  ) {
    return 0;
  }

  if (
    a === b
  ) {
    return 1;
  }

  return (
    1 -
    levenshteinDistance(
      a,
      b
    ) /
      Math.max(
        a.length,
        b.length
      )
  );
}

function parseMasterNumber(
  value: string
): number {
  const parsedValue =
    Number(
      value
    );

  return Number.isFinite(
    parsedValue
  )
    ? parsedValue
    : 0;
}

function getComparableValue(
  contract:
    ValidatableContract
): number | null {
  if (
    contract
      .valor_indeterminado
      .valor ===
    true
  ) {
    return 0;
  }

  return contract
    .valor
    .valor;
}

function isDuplicate(
  contract:
    ValidatableContract,
  existing:
    MasterContractRow
): boolean {
  return (
    contract
      .id_contrato
      .valor ===
      existing.id_contrato &&

    getComparableValue(
      contract
    ) ===
      parseMasterNumber(
        existing.valor
      ) &&

    contract
      .fecha_inicio
      .valor ===
      existing.fecha_inicio &&

    contract
      .fecha_fin
      .valor ===
      existing.fecha_fin
  );
}

type DifferenceMap =
  Record<
    string,
    {
      previous:
        | string
        | number
        | boolean
        | null;

      new:
        | string
        | number
        | boolean
        | null;
    }
  >;

function addDifference(
  differences:
    DifferenceMap,
  field: string,
  previous:
    | string
    | number
    | boolean
    | null,
  newValue:
    | string
    | number
    | boolean
    | null
): void {
  if (
    newValue !==
      null &&
    previous !==
      newValue
  ) {
    differences[
      field
    ] = {
      previous,
      new:
        newValue
    };
  }
}

function addTextDifference(
  differences:
    DifferenceMap,
  field: string,
  previous: string,
  newValue:
    string | null
): void {
  if (
    newValue ===
    null
  ) {
    return;
  }

  if (
    normalizeComparisonText(
      previous
    ) !==
    normalizeComparisonText(
      newValue
    )
  ) {
    differences[
      field
    ] = {
      previous,
      new:
        newValue
    };
  }
}

function calculateDifferences(
  contract:
    ValidatableContract,
  existing:
    MasterContractRow
): DifferenceMap {
  const differences:
    DifferenceMap = {};

  addTextDifference(
    differences,
    "cliente",
    existing.cliente,
    contract
      .cliente
      .valor
  );

  addDifference(
    differences,
    "nit_cliente",
    existing.nit_cliente,
    contract
      .nit_cliente
      .valor
  );

  addDifference(
    differences,
    "pais",
    existing.pais,
    contract
      .pais
      .valor
  );

  addTextDifference(
    differences,
    "objeto",
    existing.objeto,
    contract
      .objeto
      .valor
  );

  addDifference(
    differences,
    "valor",
    parseMasterNumber(
      existing.valor
    ),
    getComparableValue(
      contract
    )
  );

  addDifference(
    differences,
    "moneda",
    existing.moneda,
    contract
      .moneda
      .valor
  );

  addDifference(
    differences,
    "fecha_inicio",
    existing.fecha_inicio,
    contract
      .fecha_inicio
      .valor
  );

  addDifference(
    differences,
    "fecha_fin",
    existing.fecha_fin,
    contract
      .fecha_fin
      .valor
  );

  if (
    contract
      .requiere_poliza
      .valor !==
    null
  ) {
    addDifference(
      differences,
      "requiere_poliza",
      existing
        .requiere_poliza ===
        "true",
      contract
        .requiere_poliza
        .valor
    );
  }

  return differences;
}

function getNewReviewFields(
  contract:
    ValidatableContract
): string[] {
  const result =
    new Set<string>();

  const fields = [
    [
      "id_contrato",
      contract.id_contrato
    ],
    [
      "cliente",
      contract.cliente
    ],
    [
      "nit_cliente",
      contract.nit_cliente
    ],
    [
      "pais",
      contract.pais
    ],
    [
      "objeto",
      contract.objeto
    ],
    [
      "moneda",
      contract.moneda
    ],
    [
      "fecha_fin",
      contract.fecha_fin
    ],
    [
      "requiere_poliza",
      contract.requiere_poliza
    ]
  ] as const;

  for (
    const [
      name,
      field
    ] of fields
  ) {
    if (
      field.confianza <
      0.8
    ) {
      result.add(
        name
      );
    }
  }

  if (
    contract
      .valor_indeterminado
      .valor ===
      true ||
    contract
      .valor
      .confianza <
      0.8
  ) {
    result.add(
      "valor"
    );
  }

  return [
    ...result
  ];
}

function getUpdateReviewFields(
  contract:
    ValidatableContract,
  differences:
    DifferenceMap
): string[] {
  const confidences:
    Record<
      string,
      number
    > = {
      cliente:
        contract
          .cliente
          .confianza,

      nit_cliente:
        contract
          .nit_cliente
          .confianza,

      pais:
        contract
          .pais
          .confianza,

      objeto:
        contract
          .objeto
          .confianza,

      valor:
        contract
          .valor
          .confianza,

      moneda:
        contract
          .moneda
          .confianza,

      fecha_inicio:
        contract
          .fecha_inicio
          .confianza,

      fecha_fin:
        contract
          .fecha_fin
          .confianza,

      requiere_poliza:
        contract
          .requiere_poliza
          .confianza
    };

  return Object
    .keys(
      differences
    )
    .filter(
      (field) =>
        (
          confidences[
            field
          ] ??
          1
        ) <
        0.8
    );
}

// =====================================================
// PROCESSED / HISTORY / ARCHIVE
// =====================================================

async function loadProcessed(
  directory: string
): Promise<string[]> {
  try {
    const parsed =
      JSON.parse(
        await readFile(
          getProcessedPath(
            directory
          ),
          "utf-8"
        )
      );

    return Array.isArray(
      parsed
    )
      ? parsed.filter(
          (
            value
          ): value is string =>
            typeof value ===
            "string"
        )
      : [];
  } catch {
    return [];
  }
}

async function markProcessed(
  directory: string,
  messageId: string
): Promise<void> {
  await mkdir(
    getOutPath(
      directory
    ),
    {
      recursive: true
    }
  );

  const processed =
    await loadProcessed(
      directory
    );

  if (
    !processed.includes(
      messageId
    )
  ) {
    processed.push(
      messageId
    );
  }

  await writeFile(
    getProcessedPath(
      directory
    ),
    JSON.stringify(
      processed,
      null,
      2
    ),
    "utf-8"
  );
}

async function addHistory(
  directory: string,
  entry:
    Record<
      string,
      unknown
    >
): Promise<void> {
  await ensureOutputFolders(
    directory
  );

  let history:
    Record<
      string,
      unknown
    >[] = [];

  try {
    const parsed =
      JSON.parse(
        await readFile(
          getHistoryPath(
            directory
          ),
          "utf-8"
        )
      );

    if (
      Array.isArray(
        parsed
      )
    ) {
      history =
        parsed;
    }
  } catch {
    history = [];
  }

  history.push(
    entry
  );

  await writeFile(
    getHistoryPath(
      directory
    ),
    JSON.stringify(
      history,
      null,
      2
    ),
    "utf-8"
  );
}

async function archiveAttachment(
  directory: string,
  messageId: string,
  contractId: string
): Promise<string> {
  const sourceFolder =
    path.join(
      getInboxPath(
        directory
      ),
      messageId
    );

  const files =
    await readdir(
      sourceFolder
    );

  const attachment =
    files.find(
      (file) =>
        file
          .toLowerCase()
          .endsWith(
            ".txt"
          )
    );

  if (
    !attachment
  ) {
    throw new Error(
      `No attachment found for ${messageId}`
    );
  }

  const destinationFolder =
    path.join(
      getDocumentsPath(
        directory
      ),
      contractId
    );

  await mkdir(
    destinationFolder,
    {
      recursive: true
    }
  );

  const destinationName =
    `${messageId}-${attachment}`;

  const destination =
    path.join(
      destinationFolder,
      destinationName
    );

  await copyFile(
    path.join(
      sourceFolder,
      attachment
    ),
    destination
  );

  return path
    .relative(
      directory,
      destination
    )
    .replace(
      /\\/g,
      "/"
    );
}

// =====================================================
// PUBLIC TOOL: leer_buzon
// =====================================================

export const leer_buzon = {
  description:
    "Lists pending inbox messages and indicates whether each contains a contract or amendment.",

  args: {},

  async execute(
    _args: {},
    ctx: ToolContext
  ): Promise<string> {
    try {
      const processed =
        await loadProcessed(
          ctx.directory
        );

      const folders =
        await readdir(
          getInboxPath(
            ctx.directory
          ),
          {
            withFileTypes:
              true
          }
        );

      const messages = [];

      for (
        const folder
        of folders
      ) {
        if (
          !folder
            .isDirectory() ||
          processed.includes(
            folder.name
          )
        ) {
          continue;
        }

        const email =
          await loadEmail(
            folder.name,
            ctx.directory
          );

        const files =
          await readdir(
            path.join(
              getInboxPath(
                ctx.directory
              ),
              folder.name
            )
          );

        const hasContract =
          files.some(
            (file) => {
              const name =
                file
                  .toLowerCase();

              return (
                (
                  name.includes(
                    "contrato"
                  ) ||
                  name.includes(
                    "otrosi"
                  )
                ) &&
                name.endsWith(
                  ".txt"
                )
              );
            }
          );

        messages.push({
          id:
            email.id,

          de:
            email.de,

          asunto:
            email.asunto,

          fecha:
            email.fecha,

          adjuntos:
            email.adjuntos,

          tiene_contrato:
            hasContract
        });
      }

      messages.sort(
        (a, b) =>
          a.id.localeCompare(
            b.id
          )
      );

      return JSON.stringify({
        ok: true,

        data: {
          mensajes:
            messages
        }
      });
    } catch (error) {
      return JSON.stringify({
        ok: false,

        error:
          error instanceof
          Error
            ? error.message
            : "Unknown inbox error"
      });
    }
  }
};

// =====================================================
// PUBLIC TOOL: extraer
// =====================================================

export const extraer = {
  description:
    "Extracts structured contract data with confidence scores.",

  args: {
    mensaje_id:
      z
        .string()
        .min(
          1
        )
  },

  async execute(
    args: {
      mensaje_id: string;
    },
    ctx: ToolContext
  ): Promise<string> {
    try {
      return JSON.stringify({
        ok: true,

        data:
          await extractContract(
            args.mensaje_id,
            ctx.directory
          )
      });
    } catch (error) {
      return JSON.stringify({
        ok: false,

        error:
          error instanceof
          Error
            ? error.message
            : "Unknown extraction error"
      });
    }
  }
};

// =====================================================
// PUBLIC TOOL: validar
// =====================================================

export const validar = {
  description:
    "Validates extracted contract data against the contract master.",

  args: {
    mensaje_id:
      z.string(),

    contrato:
      extractedContractSchema
  },

  async execute(
    args: {
      mensaje_id: string;
      contrato:
        ValidatableContract;
    },
    ctx: ToolContext
  ): Promise<string> {
    try {
      const parsed =
        extractedContractSchema
          .safeParse(
            args.contrato
          );

      if (
        !parsed.success
      ) {
        return JSON.stringify({
          ok: false,
          error:
            parsed.error.message
        });
      }

      const contract =
        parsed.data;

      const email =
        await loadEmail(
          args.mensaje_id,
          ctx.directory
        );

      const sales =
        await loadSalesRepresentatives(
          ctx.directory
        );

      const representative =
        sales.find(
          (item) =>
            item.email
              .toLowerCase() ===
            email.de
              .toLowerCase()
        );

      const salesInfo = {
        email:
          email.de,

        encontrado:
          Boolean(
            representative
          ),

        nombre:
          representative
            ?.nombre ??
          null,

        region:
          representative
            ?.region ??
          null
      };

      if (
        contract
          .tipo_documento ===
          "cotizacion" ||
        contract
          .tipo_documento ===
          "desconocido"
      ) {
        return JSON.stringify({
          ok: true,

          data: {
            clasificacion:
              "rechazado",

            motivo:
              "The message does not contain a registrable contract or amendment.",

            requiere_revision:
              [],

            comercial:
              salesInfo
          }
        });
      }

      if (
        contract
          .tipo_documento ===
          "contrato" &&
        (
          !contract
            .cliente
            .valor ||
          !contract
            .objeto
            .valor
        )
      ) {
        return JSON.stringify({
          ok: true,

          data: {
            clasificacion:
              "rechazado",

            motivo:
              "The contract parties or business object could not be identified.",

            requiere_revision:
              [],

            comercial:
              salesInfo
          }
        });
      }

      const master =
        await loadMaster(
          ctx.directory
        );

      let existing =
        contract
          .id_contrato
          .valor
          ? master.find(
              (row) =>
                row
                  .id_contrato ===
                contract
                  .id_contrato
                  .valor
            )
          : undefined;

      if (
        !existing &&
        contract
          .nit_cliente
          .valor &&
        contract
          .objeto
          .valor
      ) {
        existing =
          master.find(
            (row) =>
              row
                .nit_cliente ===
                contract
                  .nit_cliente
                  .valor &&
              textSimilarity(
                row.objeto,
                contract
                  .objeto
                  .valor ??
                  ""
              ) >=
                0.9
          );
      }

      if (
        existing &&
        isDuplicate(
          contract,
          existing
        )
      ) {
        return JSON.stringify({
          ok: true,

          data: {
            clasificacion:
              "duplicado",

            id_contrato_existente:
              existing
                .id_contrato,

            requiere_revision:
              [],

            diferencias:
              {},

            comercial:
              salesInfo
          }
        });
      }

      if (
        existing
      ) {
        const differences =
          calculateDifferences(
            contract,
            existing
          );

        return JSON.stringify({
          ok: true,

          data: {
            clasificacion:
              "actualizacion",

            id_contrato_existente:
              existing
                .id_contrato,

            requiere_revision:
              getUpdateReviewFields(
                contract,
                differences
              ),

            diferencias:
              differences,

            comercial:
              salesInfo
          }
        });
      }

      if (
        contract
          .tipo_documento ===
        "otrosi"
      ) {
        return JSON.stringify({
          ok: true,

          data: {
            clasificacion:
              "rechazado",

            motivo:
              "The amendment base contract was not found.",

            requiere_revision:
              [],

            comercial:
              salesInfo
          }
        });
      }

      return JSON.stringify({
        ok: true,

        data: {
          clasificacion:
            "nuevo",

          requiere_revision:
            getNewReviewFields(
              contract
            ),

          comercial:
            salesInfo,

          valor_normalizado:
            contract
              .valor_indeterminado
              .valor
              ? 0
              : contract
                  .valor
                  .valor
        }
      });
    } catch (error) {
      return JSON.stringify({
        ok: false,

        error:
          error instanceof
          Error
            ? error.message
            : "Unknown validation error"
      });
    }
  }
};

// =====================================================
// PUBLIC TOOL: registrar
// =====================================================

export const registrar = {
  description:
    "Registers or updates a contract in the simulated SharePoint master. The registrar independently re-extracts and revalidates source data before any write, and human confirmation is required when review fields exist.",

  args: {
    mensaje_id:
      z.string(),

    contrato:
      extractedContractSchema,

    validacion:
      validationResultSchema,

    confirmado:
      z
        .boolean()
        .default(
          false
        ),

    campos_confirmados:
      z
        .object({
          valor:
            z
              .number()
              .optional(),

          fecha_fin:
            z
              .string()
              .optional()
        })
        .optional()
  },

  async execute(
    args: {
      mensaje_id: string;

      contrato:
        ValidatableContract;

      validacion:
        ValidationResult;

      confirmado:
        boolean;

      campos_confirmados?: {
        valor?: number;
        fecha_fin?: string;
      };
    },
    ctx: ToolContext
  ): Promise<string> {
    try {
      // Validate caller-supplied payload shapes, but never trust them as
      // authoritative business state.
      const parsedContract =
        extractedContractSchema
          .safeParse(
            args.contrato
          );

      const parsedValidation =
        validationResultSchema
          .safeParse(
            args.validacion
          );

      if (
        !parsedContract.success
      ) {
        return JSON.stringify({
          ok: false,

          error:
            "Invalid contract payload"
        });
      }

      if (
        !parsedValidation.success
      ) {
        return JSON.stringify({
          ok: false,

          error:
            "Invalid validation payload"
        });
      }

      // SECURITY BOUNDARY:
      // Re-extract the contract from the original inbox message and re-run
      // deterministic validation inside registrar. This prevents an LLM or
      // API caller from bypassing review by tampering with `contrato` or
      // `validacion` before the write boundary.
      const contract =
        await extractContract(
          args.mensaje_id,
          ctx.directory
        );

      const authoritativeValidationResponse =
        await validar.execute(
          {
            mensaje_id:
              args.mensaje_id,

            contrato:
              contract
          },
          ctx
        );

      const validationEnvelope =
        JSON.parse(
          authoritativeValidationResponse
        ) as {
          ok?: boolean;
          data?: unknown;
          error?: string;
        };

      if (
        validationEnvelope.ok !==
          true
      ) {
        return JSON.stringify({
          ok: false,

          error:
            validationEnvelope.error ??
            "Deterministic revalidation failed before registration."
        });
      }

      const authoritativeValidation =
        validationResultSchema
          .safeParse(
            validationEnvelope.data
          );

      if (
        !authoritativeValidation.success
      ) {
        return JSON.stringify({
          ok: false,

          error:
            "Deterministic revalidation returned an invalid payload."
        });
      }

      const validation =
        authoritativeValidation.data;

      const email =
        await loadEmail(
          args.mensaje_id,
          ctx.directory
        );

      // Human-in-the-loop write protection.
      if (
        validation
          .requiere_revision
          .length >
          0 &&
        args.confirmado !==
          true
      ) {
        return JSON.stringify({
          ok: false,

          error:
            "Human confirmation is required before registration.",

          requires_confirmation:
            true,

          fields:
            validation
              .requiere_revision
        });
      }

      if (
        validation
          .requiere_revision
          .includes(
            "valor"
          ) &&
        args.confirmado &&
        args
          .campos_confirmados
          ?.valor ===
          undefined
      ) {
        return JSON.stringify({
          ok: false,

          error:
            "Confirmed value is required.",

          requires_confirmation:
            true,

          fields: [
            "valor"
          ]
        });
      }

      if (
        validation
          .requiere_revision
          .includes(
            "fecha_fin"
          ) &&
        args.confirmado &&
        !args
          .campos_confirmados
          ?.fecha_fin
      ) {
        return JSON.stringify({
          ok: false,

          error:
            "Confirmed end date is required.",

          requires_confirmation:
            true,

          fields: [
            "fecha_fin"
          ]
        });
      }

      if (
        validation
          .clasificacion ===
          "duplicado" ||
        validation
          .clasificacion ===
          "rechazado"
      ) {
        await markProcessed(
          ctx.directory,
          args.mensaje_id
        );

        await addHistory(
          ctx.directory,
          {
            timestamp:
              email.fecha,

            mensaje_id:
              args.mensaje_id,

            session_id:
              ctx.sessionId,

            action:
              validation
                .clasificacion,

            master_modified:
              false
          }
        );

        return JSON.stringify({
          ok: true,

          data: {
            accion:
              validation
                .clasificacion,

            registrado:
              false,

            master_modified:
              false
          }
        });
      }

      await ensureOutputFolders(
        ctx.directory
      );

      const master =
        await loadMaster(
          ctx.directory
        );

      const sales =
        await loadSalesRepresentatives(
          ctx.directory
        );

      const representative =
        sales.find(
          (item) =>
            item.email
              .toLowerCase() ===
            email.de
              .toLowerCase()
        );

      const contractId =
        contract
          .id_contrato
          .valor ??
        validation
          .id_contrato_existente;

      if (
        !contractId
      ) {
        return JSON.stringify({
          ok: false,

          error:
            "Contract ID is required for registration."
        });
      }

      const archivedPath =
        await archiveAttachment(
          ctx.directory,
          args.mensaje_id,
          contractId
        );

      const confirmedValue =
        args
          .campos_confirmados
          ?.valor;

      const normalizedValue =
        confirmedValue !==
        undefined
          ? confirmedValue
          : contract
              .valor_indeterminado
              .valor
            ? 0
            : contract
                .valor
                .valor;

      const confirmedEndDate =
        args
          .campos_confirmados
          ?.fecha_fin ??
        contract
          .fecha_fin
          .valor;

      const policyRequired =
        contract
          .requiere_poliza
          .valor;

      const policyStatus =
        policyRequired ===
        true
          ? "pendiente"
          : policyRequired ===
              false
            ? "no_aplica"
            : "";

      if (
        validation
          .clasificacion ===
        "nuevo"
      ) {
        const row:
          MasterContractRow = {
          id_contrato:
            contractId,

          cliente:
            contract
              .cliente
              .valor ??
            "",

          nit_cliente:
            contract
              .nit_cliente
              .valor ??
            "",

          pais:
            contract
              .pais
              .valor ??
            "",

          objeto:
            contract
              .objeto
              .valor ??
            "",

          valor:
            normalizedValue !==
            null
              ? String(
                  normalizedValue
                )
              : "",

          moneda:
            contract
              .moneda
              .valor ??
            "",

          fecha_inicio:
            contract
              .fecha_inicio
              .valor ??
            "",

          fecha_fin:
            confirmedEndDate ??
            "",

          requiere_poliza:
            policyRequired ===
            null
              ? ""
              : String(
                  policyRequired
                ),

          tipo_poliza:
            contract
              .tipo_poliza
              .valor ??
            "",

          estado_poliza:
            policyStatus,

          comercial:
            representative
              ?.nombre ??
            email.de,

          ruta_sharepoint:
            archivedPath,

          fecha_registro:
            getDateFromEmail(
              email
            ),

          fuente:
            "buzon"
        };

        master.push(
          row
        );

        await saveMaster(
          ctx.directory,
          master
        );

        await markProcessed(
          ctx.directory,
          args.mensaje_id
        );

        await addHistory(
          ctx.directory,
          {
            timestamp:
              email.fecha,

            mensaje_id:
              args.mensaje_id,

            contract_id:
              contractId,

            session_id:
              ctx.sessionId,

            action:
              "created",

            confirmed:
              args.confirmado,

            confirmed_fields:
              args
                .campos_confirmados ??
              {},

            row
          }
        );

        return JSON.stringify({
          ok: true,

          data: {
            accion:
              "created",

            registrado:
              true,

            id_contrato:
              contractId,

            ruta_sharepoint:
              archivedPath,

            master:
              getOutputMasterPath(
                ctx.directory
              )
          }
        });
      }

      if (
        validation
          .clasificacion ===
        "actualizacion"
      ) {
        const index =
          master.findIndex(
            (row) =>
              row
                .id_contrato ===
              validation
                .id_contrato_existente
          );

        if (
          index ===
          -1
        ) {
          return JSON.stringify({
            ok: false,

            error:
              "Existing contract was not found during update."
          });
        }

        const previous = {
          ...master[
            index
          ]!
        };

        const existing =
          master[
            index
          ]!;

        if (
          contract
            .cliente
            .valor !==
          null
        ) {
          existing.cliente =
            contract
              .cliente
              .valor;
        }

        if (
          contract
            .nit_cliente
            .valor !==
          null
        ) {
          existing.nit_cliente =
            contract
              .nit_cliente
              .valor;
        }

        if (
          contract
            .pais
            .valor !==
          null
        ) {
          existing.pais =
            contract
              .pais
              .valor;
        }

        if (
          contract
            .objeto
            .valor !==
          null
        ) {
          existing.objeto =
            contract
              .objeto
              .valor;
        }

        if (
          normalizedValue !==
          null
        ) {
          existing.valor =
            String(
              normalizedValue
            );
        }

        if (
          contract
            .moneda
            .valor !==
          null
        ) {
          existing.moneda =
            contract
              .moneda
              .valor;
        }

        if (
          contract
            .fecha_inicio
            .valor !==
          null
        ) {
          existing.fecha_inicio =
            contract
              .fecha_inicio
              .valor;
        }

        if (
          confirmedEndDate !==
          null
        ) {
          existing.fecha_fin =
            confirmedEndDate;
        }

        if (
          policyRequired !==
          null
        ) {
          existing.requiere_poliza =
            String(
              policyRequired
            );
        }

        if (
          contract
            .tipo_poliza
            .valor !==
          null
        ) {
          existing.tipo_poliza =
            contract
              .tipo_poliza
              .valor;
        }

        existing.ruta_sharepoint =
          archivedPath;

        existing.fecha_registro =
          getDateFromEmail(
            email
          );

        await saveMaster(
          ctx.directory,
          master
        );

        await markProcessed(
          ctx.directory,
          args.mensaje_id
        );

        await addHistory(
          ctx.directory,
          {
            timestamp:
              email.fecha,

            mensaje_id:
              args.mensaje_id,

            contract_id:
              contractId,

            session_id:
              ctx.sessionId,

            action:
              "updated",

            changes:
              validation
                .diferencias ??
              {},

            previous,

            current:
              existing
          }
        );

        return JSON.stringify({
          ok: true,

          data: {
            accion:
              "updated",

            registrado:
              true,

            id_contrato:
              contractId,

            ruta_sharepoint:
              archivedPath,

            master:
              getOutputMasterPath(
                ctx.directory
              )
          }
        });
      }

      return JSON.stringify({
        ok: false,

        error:
          "Unsupported registration classification."
      });
    } catch (error) {
      return JSON.stringify({
        ok: false,

        error:
          error instanceof
          Error
            ? error.message
            : "Unknown registration error"
      });
    }
  }
};

// =====================================================
// PUBLIC TOOL: alertas
// =====================================================

export const alertas = {
  description:
    "Generates deterministic contract expiration and policy alerts from the contract master.",

  args: {
    fecha_referencia:
      z
        .string()
        .regex(
          /^\d{4}-\d{2}-\d{2}$/,
          "Reference date must use YYYY-MM-DD format"
        )
  },

  async execute(
    args: {
      fecha_referencia:
        string;
    },
    ctx: ToolContext
  ): Promise<string> {
    try {
      const referenceDate =
        parseIsoDate(
          args.fecha_referencia
        );

      if (
        !referenceDate
      ) {
        return JSON.stringify({
          ok: false,

          error:
            "Invalid reference date."
        });
      }

      const master =
        await loadMaster(
          ctx.directory
        );

      const alerts:
        ContractAlert[] = [];

      for (
        const row
        of master
      ) {
        const reasons:
          string[] = [];

        let daysToExpiration:
          number | null =
          null;

        const endDate =
          parseIsoDate(
            row.fecha_fin
          );

        /*
         * Expiration alert:
         * contract ends between today/reference date
         * and 60 calendar days from that date.
         */
        if (
          endDate
        ) {
          daysToExpiration =
            daysBetween(
              referenceDate,
              endDate
            );

          if (
            daysToExpiration >=
              0 &&
            daysToExpiration <=
              60
          ) {
            reasons.push(
              `Contract expires in ${daysToExpiration} day(s).`
            );
          }
        }

        /*
         * Policy alert:
         * policy is required but not currently vigente.
         */
        const requiresPolicy =
          row
            .requiere_poliza
            .trim()
            .toLowerCase() ===
          "true";

        const policyStatus =
          row
            .estado_poliza
            .trim()
            .toLowerCase();

        if (
          requiresPolicy &&
          policyStatus !==
            "vigente"
        ) {
          reasons.push(
            `Required policy is not vigente (current status: ${row.estado_poliza || "missing"}).`
          );
        }

        if (
          reasons.length >
          0
        ) {
          alerts.push({
            id_contrato:
              row.id_contrato,

            cliente:
              row.cliente,

            fecha_fin:
              row.fecha_fin,

            requiere_poliza:
              requiresPolicy,

            estado_poliza:
              row.estado_poliza,

            dias_para_vencimiento:
              daysToExpiration,

            razones:
              reasons
          });
        }
      }

      alerts.sort(
        (
          first,
          second
        ) => {
          const firstDays =
            first
              .dias_para_vencimiento ??
            Number.MAX_SAFE_INTEGER;

          const secondDays =
            second
              .dias_para_vencimiento ??
            Number.MAX_SAFE_INTEGER;

          if (
            firstDays !==
            secondDays
          ) {
            return (
              firstDays -
              secondDays
            );
          }

          return first
            .id_contrato
            .localeCompare(
              second.id_contrato
            );
        }
      );

      await ensureOutputFolders(
        ctx.directory
      );

      const report = {
        fecha_referencia:
          args.fecha_referencia,

        ventana_vencimiento_dias:
          60,

        total_alertas:
          alerts.length,

        alertas:
          alerts
      };

      await writeFile(
        getAlertsPath(
          ctx.directory
        ),
        JSON.stringify(
          report,
          null,
          2
        ),
        "utf-8"
      );

      return JSON.stringify({
        ok: true,

        data: {
          ...report,

          archivo:
            path
              .relative(
                ctx.directory,
                getAlertsPath(
                  ctx.directory
                )
              )
              .replace(
                /\\/g,
                "/"
              )
        }
      });
    } catch (error) {
      return JSON.stringify({
        ok: false,

        error:
          error instanceof
          Error
            ? error.message
            : "Unknown alert generation error"
      });
    }
  }
};