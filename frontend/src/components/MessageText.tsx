import { Fragment } from 'react';

/**
 * Render isi pesan chat dengan dukungan tebal gaya markdown.
 * Penanda **teks** tampil sebagai huruf tebal; karakter lain apa adanya.
 * Aman dipakai saat animasi ketik karena potongan penanda yang belum lengkap
 * tetap tampil apa adanya lalu otomatis menjadi tebal begitu penandanya utuh.
 */
export default function MessageText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.length > 4 && part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
