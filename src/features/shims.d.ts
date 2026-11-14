// The rest of the app is plain JS; the features only need this one helper from it.
declare module '@/lib/utils' {
  export function cn(...inputs: unknown[]): string;
}

// pdf.js 3.x ships no types for its prebuilt bundle.
declare module 'pdfjs-dist/build/pdf' {
  interface PdfJs {
    GlobalWorkerOptions: { workerSrc: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getDocument(src: { data: ArrayBuffer }): { promise: Promise<any> };
  }
  const pdfjs: PdfJs & { default?: PdfJs };
  export = pdfjs;
}
