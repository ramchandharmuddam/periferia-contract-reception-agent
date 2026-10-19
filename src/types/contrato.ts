export type Country =
  | "CO"
  | "EC"
  | "PE"
  | "PA"
  | "HN";

export type Currency =
  | "COP"
  | "USD"
  | "PEN"
  | "PAB"
  | "HNL";

export type PolicyStatus =
  | "vigente"
  | "pendiente"
  | "vencida"
  | "no_aplica";

export type Source =
  | "buzon"
  | "manual"
  | "migracion";

export type DocumentType =
  | "contrato"
  | "otrosi"
  | "cotizacion"
  | "desconocido";

export interface ExtractedField<T> {
  valor: T | null;
  confianza: number;
}

export interface ExtractedContract {
  mensaje_id: string;

  tipo_documento:
    DocumentType;

  id_contrato:
    ExtractedField<string>;

  cliente:
    ExtractedField<string>;

  nit_cliente:
    ExtractedField<string>;

  pais:
    ExtractedField<Country>;

  objeto:
    ExtractedField<string>;

  valor:
    ExtractedField<number>;

  valor_indeterminado:
    ExtractedField<boolean>;

  moneda:
    ExtractedField<Currency>;

  fecha_inicio:
    ExtractedField<string>;

  fecha_fin:
    ExtractedField<string>;

  requiere_poliza:
    ExtractedField<boolean>;

  tipo_poliza:
    ExtractedField<string>;
}