/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// New uploads go to this store's own bucket. Existing product photos keep
// their old addresses and keep working.
const BUCKET = "product-images";
const MAX_INPUT_BYTES = 25 * 1024 * 1024; // refuse absurdly large originals
const MAX_SIDE = 1200; // pixels on the longest side
const JPEG_QUALITY = 0.85;

interface ImageUploaderProps {
  currentImageUrl?: string;
  onUploadSuccess: (url: string) => void;
}

interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
}

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      /* fall back to a normal image element below */
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("This image could not be read. Try a JPEG or PNG photo."));
      el.src = objectUrl;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Shrinks the photo and saves it as a JPEG. This also removes hidden data
// such as the location the photo was taken at.
async function compressToJpeg(file: File): Promise<Blob> {
  const { source, width, height, close } = await loadImage(file);
  try {
    if (!width || !height) throw new Error("This image appears to be empty.");

    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not process the image.");

    // White background so transparent PNGs don't turn black
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob) throw new Error("Could not prepare the image for upload.");
    return blob;
  } finally {
    close?.();
  }
}

function friendlyError(err: unknown): string {
  const raw = (err as { message?: string } | null)?.message || "";
  if (/row-level security|not authorized|permission|unauthorized|jwt/i.test(raw)) {
    return "You don't have permission to upload photos. Only admins can. Try logging in again.";
  }
  if (/bucket not found/i.test(raw)) {
    return "The photo storage bucket could not be found. Please contact support.";
  }
  if (/size|too large|exceed|payload/i.test(raw)) {
    return "The photo is too large. Try a smaller one.";
  }
  if (/mime|content.?type|not allowed/i.test(raw)) {
    return "That file type is not allowed. Use a JPEG or PNG photo.";
  }
  return raw ? `Upload failed: ${raw}` : "Upload failed. Please try again.";
}

export default function ImageUploader({ currentImageUrl, onUploadSuccess }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    setErrorMsg("");

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please choose an image file.");
      input.value = "";
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setErrorMsg("That photo is too large (over 25 MB). Please choose a smaller one.");
      input.value = "";
      return;
    }

    try {
      setUploading(true);

      const blob = await compressToJpeg(file);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.jpeg`;

      const { data, error } = await supabase.storage.from(BUCKET).upload(fileName, blob, {
        contentType: "image/jpeg",
        cacheControl: "31536000", // file names are unique, so a long cache is safe
        upsert: false,
      });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);

      onUploadSuccess(publicUrlData.publicUrl);
    } catch (err) {
      console.error("Error uploading image:", err);
      setErrorMsg(friendlyError(err));
    } finally {
      setUploading(false);
      input.value = ""; // lets the same file be chosen again if needed
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {currentImageUrl && (
        <img src={currentImageUrl} alt="Product Preview" className="h-20 w-20 object-cover rounded border border-slate-700" />
      )}
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
        className="text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-500 file:text-slate-950 hover:file:bg-cyan-400 file:cursor-pointer disabled:opacity-50"
      />
      {uploading && <p className="text-xs text-cyan-400 font-medium">Uploading image...</p>}
      {errorMsg && (
        <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2">{errorMsg}</p>
      )}
    </div>
  );
}