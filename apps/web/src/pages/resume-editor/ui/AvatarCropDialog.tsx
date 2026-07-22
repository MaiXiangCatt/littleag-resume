import Cropper, { type Area } from 'react-easy-crop';
import { Minus, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/shared/ui/dialog';

export function AvatarCropDialog({ image, onClose, onSave }: { image: string; onClose: () => void; onSave: (blob: Blob) => Promise<void> }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const complete = useCallback((_percent: Area, pixels: Area) => setArea(pixels), []);
  async function save() {
    if (!area) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(await cropAvatar(image, area));
    } catch {
      setError('头像上传失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  }
  return <Dialog onOpenChange={(open) => { if (!open && !saving) onClose(); }} open><DialogContent className="max-w-xl rounded-3xl p-6"><DialogTitle>裁剪简历头像</DialogTitle><DialogDescription>拖动图片并调整缩放，头像会保存为清晰的方形图片。</DialogDescription><div className="relative mt-3 h-96 overflow-hidden rounded-2xl bg-[#171317]"><Cropper aspect={1} crop={crop} cropShape="round" image={image} onCropChange={setCrop} onCropComplete={complete} onZoomChange={setZoom} showGrid={false} zoom={zoom} /></div><div className="mt-4 flex items-center justify-center gap-3"><Button aria-label="缩小头像" disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value - 0.15))} size="icon" variant="outline"><Minus size={16} /></Button><span className="w-20 text-center text-sm text-[#746873]">{Math.round(zoom * 100)}%</span><Button aria-label="放大头像" disabled={zoom >= 3} onClick={() => setZoom((value) => Math.min(3, value + 0.15))} size="icon" variant="outline"><Plus size={16} /></Button></div>{error ? <p className="mt-3 text-sm text-red-600" role="alert">{error}</p> : null}<DialogFooter><Button disabled={saving} onClick={onClose} variant="outline">取消</Button><Button disabled={!area || saving} onClick={() => void save()}>{saving ? '正在上传…' : '确认头像'}</Button></DialogFooter></DialogContent></Dialog>;
}

async function cropAvatar(source: string, area: Area) {
  const image = await loadImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器无法处理图片');
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, 512, 512);
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, 512, 512);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('头像处理失败')), 'image/jpeg', 0.88));
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('无法读取图片')); image.src = source; });
}
