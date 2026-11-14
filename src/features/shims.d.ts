// The rest of the app is plain JS; the features only need this one helper from it.
declare module '@/lib/utils' {
  export function cn(...inputs: unknown[]): string;
}

declare module 'pdfjs-dist/build/pdf' {
  export const GlobalWorkerOptions: { workerSrc: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function getDocument(src: { data: ArrayBuffer }): { promise: Promise<any> };
}
