import { MAX_PROFILE_PHOTO_LENGTH } from './profile';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Store only a small, re-encoded thumbnail, without the original photo metadata. */
export async function prepareAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') throw new Error('Scegli una foto in formato JPG, PNG o WebP.');
  if (file.size > MAX_FILE_BYTES) throw new Error('La foto supera 10 MB. Scegli un’immagine più piccola.');
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const picture = new Image();
      const timer = window.setTimeout(() => { picture.src = ''; reject(new Error('La foto non si apre. Prova un’immagine JPG, PNG o WebP.')); }, 15_000);
      picture.onload = () => { window.clearTimeout(timer); resolve(picture); };
      picture.onerror = () => { window.clearTimeout(timer); reject(new Error('La foto non si apre. Prova un’immagine JPG, PNG o WebP.')); };
      picture.src = url;
    });
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side) throw new Error('Questa foto è vuota. Scegli un’altra immagine.');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(384, side);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Non riesco a preparare la foto. Riprova.');
    context.fillStyle = '#23232c';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.5]) {
      const result = canvas.toDataURL('image/jpeg', quality);
      if (result.startsWith('data:image/jpeg;base64,') && result.length <= MAX_PROFILE_PHOTO_LENGTH) return result;
    }
    throw new Error('La foto è troppo dettagliata. Scegli un’immagine più piccola.');
  } finally { URL.revokeObjectURL(url); }
}
