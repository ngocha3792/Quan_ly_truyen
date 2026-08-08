const MB = 1024 * 1024;

export const AUTHOR_APPLICATION_SAMPLE_FILE_POLICY = {
  maximumFileSizeMb: 10,

  maxBytes: 10 * MB,

  allowedExtensions: ['.doc', '.docx', '.pdf', '.txt'] as const,

  allowedFormats: ['doc', 'docx', 'pdf', 'txt'] as const,

  allowedMimeTypes: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
    'text/plain',
  ] as const,

  mimeFormatPairs: {
    'application/msword': ['doc'],

    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
      'docx',
    ],

    'application/pdf': ['pdf'],

    'text/plain': ['txt'],
  } as const,
} as const;
