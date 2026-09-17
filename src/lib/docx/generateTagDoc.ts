import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
  HeightRule,
} from 'docx';

export interface TagDocParams {
  requestNumber: string;
  plateNumber: string;
  floorCode: string;
  lotNumber: string;
  parkerName?: string;
  companyName?: string;
}

// Document colors for the signboard layout.
const BRAND_GREEN = '22B557';
const DARK = '111827';

// Invisible borders for the nested header layout table (company left / lot right)
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
};

/**
 * Generates a DOCX for the vehicle number plate signboard tag.
 * Layout: a prominent bordered box
 * (company name top-left, floor + lot number top-right e.g. "P1-12", plate number centred).
 */
export async function generateNumberPlateDoc(params: TagDocParams): Promise<Buffer> {
  const { plateNumber, companyName, floorCode, lotNumber } = params;

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // ── Plate number in a prominent bordered box ──
          new Paragraph({ spacing: { before: 300 }, children: [] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                height: { value: 2400, rule: HeightRule.ATLEAST },
                children: [
                  new TableCell({
                    verticalAlign: VerticalAlign.CENTER,
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 18, color: DARK },
                      bottom: { style: BorderStyle.SINGLE, size: 18, color: DARK },
                      left: { style: BorderStyle.SINGLE, size: 18, color: DARK },
                      right: { style: BorderStyle.SINGLE, size: 18, color: DARK },
                    },
                    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FFFFFF' },
                    children: [
                      // Top row: company name pinned left, floor + lot number pinned right
                      new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: NO_BORDERS,
                        rows: [
                          new TableRow({
                            children: [
                              new TableCell({
                                width: { size: 60, type: WidthType.PERCENTAGE },
                                borders: NO_BORDERS,
                                children: [
                                  new Paragraph({
                                    alignment: AlignmentType.LEFT,
                                    children: [
                                      new TextRun({
                                        text: (companyName || '—').toUpperCase(),
                                        bold: true,
                                        size: 28, // 14pt
                                        color: DARK,
                                      }),
                                    ],
                                  }),
                                ],
                              }),
                              new TableCell({
                                width: { size: 40, type: WidthType.PERCENTAGE },
                                borders: NO_BORDERS,
                                children: [
                                  new Paragraph({
                                    alignment: AlignmentType.RIGHT,
                                    children: [
                                      new TextRun({
                                        text: `${(floorCode || 'GF').toUpperCase()}-${lotNumber}`,
                                        bold: true,
                                        size: 28, // 14pt
                                        color: BRAND_GREEN,
                                      }),
                                    ],
                                  }),
                                ],
                              }),
                            ],
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 200 },
                        children: [
                          new TextRun({
                            text: plateNumber.toUpperCase(),
                            bold: true,
                            size: 140, // 70pt — highly visible for physical signboard
                            color: DARK,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}