export type CropArea = { x: number; y: number; width: number; height: number };

export async function cropAvatar(source: string, area: CropArea): Promise<Blob> {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(768, Math.round(area.width));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Не вдалося обробити фото. Спробуйте інший браузер.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не вдалося обробити фото.')), 'image/webp', 0.85));
}
