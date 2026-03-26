"use client";

import Uploader from "@/components/Uploader";  // Sesuaikan path-nya

export default function StoryUploader({ tempatId, namaTempat }) {
  console.log("StoryUploader rendering dengan tempatId:", tempatId);  // Debug
  
  return (
    <Uploader 
      tempatId={tempatId}
      namaTempat={namaTempat}
      onUploadSuccess={(url, isOfficial) => {
        console.log("Upload berhasil:", url);
        // Trigger refresh atau callback ke parent
      }}
    />
  );
}