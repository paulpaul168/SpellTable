import React, { useState } from 'react';

interface UploadDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (file: File) => void;
}

export const UploadDialog: React.FC<UploadDialogProps> = ({ isOpen, onClose, onUpload }) => {
    const [dragActive, setDragActive] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setSelectedFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleSubmit = () => {
        if (selectedFile) {
            onUpload(selectedFile);
            setSelectedFile(null);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h2 className="text-xl font-bold mb-4">Upload Map</h2>

                <div
                    className={`border-2 border-dashed rounded-lg p-8 mb-4 text-center cursor-pointer
                        ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
                        ${selectedFile ? 'bg-green-50' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        className="hidden"
                        onChange={handleFileSelect}
                        accept="image/*"
                        id="map-upload"
                    />
                    <label htmlFor="map-upload" className="cursor-pointer">
                        {selectedFile ? (
                            <p className="text-green-600">{selectedFile.name}</p>
                        ) : (
                            <div>
                                <p>Drag and drop your map here</p>
                                <p className="text-sm text-gray-500">or click to select</p>
                            </div>
                        )}
                    </label>
                </div>

                <div className="flex justify-end space-x-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!selectedFile}
                        className={`px-4 py-2 rounded text-white
                            ${selectedFile
                                ? 'bg-blue-500 hover:bg-blue-600'
                                : 'bg-gray-300 cursor-not-allowed'}`}
                    >
                        Upload
                    </button>
                </div>
            </div>
        </div>
    );
}; 