'use client';

import { useState } from 'react';
import { validateUploadFile, MAX_UPLOAD_BYTES } from '@/portals/citizen/lib/storage/file-validation';

interface VoterIdUploadProps {
  file: File | null;
  onFile: (file: File) => void;
  /** Bold call to action, e.g. "Upload Voter's ID" or "Replace Voter's ID". */
  title: string;
  /** Small line under the title, e.g. "Click to select file". */
  hint: string;
  /** Input element id — must be unique if two ever render on one page. */
  inputId?: string;
}

export function VoterIdUpload({ file, onFile, title, hint, inputId = 'idFileInput' }: VoterIdUploadProps) {
  const [fileError, setFileError] = useState('');

  const handleFileUpload = async (candidate: File) => {
    const problem = await validateUploadFile(candidate, 'imageOrPdf');
    if (problem) {
      setFileError(problem);
      return;
    }
    setFileError('');
    onFile(candidate);
  };

  return (
    <div style={{
      border: '2px dashed #003DA5',
      borderRadius: 8,
      padding: 24,
      textAlign: 'center',
      backgroundColor: 'rgba(0, 61, 165, 0.02)',
      cursor: 'pointer',
      transition: 'all 0.2s',
    }}>
      <input
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        style={{ display: 'none' }}
        id={inputId}
        onChange={(e) => {
          const candidate = e.target.files?.[0];
          e.target.value = '';
          if (candidate) void handleFileUpload(candidate);
        }}
      />
      <label htmlFor={inputId} style={{ cursor: 'pointer', display: 'block' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#003DA5', marginBottom: 4 }}>{title}</p>
        <p style={{ fontSize: 12, color: '#666666' }}>{hint}</p>
        <p style={{ fontSize: 11, color: '#666666', marginTop: 8 }}>
          PNG, JPG, PDF (max {MAX_UPLOAD_BYTES / (1024 * 1024)}MB)
        </p>
        {file && (
          <p style={{ fontSize: 12, color: '#10B981', fontWeight: 600, marginTop: 8 }}>✓ {file.name}</p>
        )}
      </label>
      {fileError && (
        <p style={{ color: '#C62828', fontSize: 11, marginTop: 8 }}>{fileError}</p>
      )}
    </div>
  );
}
