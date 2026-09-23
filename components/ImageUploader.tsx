/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface ImageUploaderProps {
  currentImageUrl?: string;
  onUploadSuccess: (url: string) => void;
}

export default function ImageUploader({ currentImageUrl, onUploadSuccess }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("product-images")
        .upload(fileName, file);

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(data.path);

      onUploadSuccess(publicUrlData.publicUrl);
    } catch (err) {
      console.error("Error uploading image:", err);
      alert("Failed to upload image.");
    } finally {
      setUploading(false);
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
    </div>
  );
}