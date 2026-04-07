import { useState } from "react";
import { ArrowRight, X } from "lucide-react";

interface EzyVetFieldOption {
    value: string;
    label: string;
}

interface SectionMapping {
    title: string;
    ezyVetMapping: string;
}

interface SectionMappingDialogProps {
    sections: { title: string; content: string }[];
    existingMappings: SectionMapping[];
    ezyVetFields?: EzyVetFieldOption[];
    onConfirm: (mappings: SectionMapping[]) => void;
    onCancel: () => void;
}

// Fallback fields if no dynamic config is provided
const DEFAULT_EZYVET_FIELDS: EzyVetFieldOption[] = [
    { value: "", label: "-- Select --" },
    { value: "history", label: "History (Subjective)" },
    { value: "physical_exam", label: "Physical Exam (Objective)" },
    { value: "differential_diagnosis", label: "Differential Diagnosis (Assessment)" },
    { value: "plan", label: "Plan" },
    { value: "none", label: "Skip (Don't paste)" },
];

export function SectionMappingDialog({
    sections,
    existingMappings,
    ezyVetFields,
    onConfirm,
    onCancel,
}: SectionMappingDialogProps) {
    const fieldOptions: EzyVetFieldOption[] = ezyVetFields && ezyVetFields.length > 0
        ? [{ value: "", label: "-- Select --" }, ...ezyVetFields, { value: "none", label: "Skip (Don't paste)" }]
        : DEFAULT_EZYVET_FIELDS;

    // Initialize mappings from existing or empty
    const [mappings, setMappings] = useState<SectionMapping[]>(() =>
        sections.map((section) => {
            const existing = existingMappings.find((m) => m.title === section.title);
            return {
                title: section.title,
                ezyVetMapping: existing?.ezyVetMapping || "",
            };
        })
    );

    const updateMapping = (title: string, ezyVetMapping: string) => {
        setMappings((prev) =>
            prev.map((m) => (m.title === title ? { ...m, ezyVetMapping } : m))
        );
    };

    const handleConfirm = () => {
        // Filter out "none" and empty mappings for the final result
        const validMappings = mappings.filter(
            (m) => m.ezyVetMapping && m.ezyVetMapping !== "none"
        );
        onConfirm(validMappings);
    };

    const hasAnyMapping = mappings.some(
        (m) => m.ezyVetMapping && m.ezyVetMapping !== "none"
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold text-lg">Map Sections to EzyVet</h3>
                    <button
                        onClick={onCancel}
                        className="p-1 hover:bg-gray-100 rounded"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1">
                    <p className="text-sm text-gray-600 mb-4">
                        Assign each section to an EzyVet field for pasting:
                    </p>

                    <div className="space-y-3">
                        {sections.map((section) => {
                            const mapping = mappings.find((m) => m.title === section.title);
                            return (
                                <div
                                    key={section.title}
                                    className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm truncate">
                                            {section.title}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">
                                            {section.content?.substring(0, 50) || "No content"}...
                                        </div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <select
                                        value={mapping?.ezyVetMapping || ""}
                                        onChange={(e) => updateMapping(section.title, e.target.value)}
                                        className="text-sm border rounded p-1.5 bg-white min-w-[140px]"
                                    >
                                        {fieldOptions.map((field) => (
                                            <option key={field.value} value={field.value}>
                                                {field.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!hasAnyMapping}
                        className="px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Paste to EzyVet
                    </button>
                </div>
            </div>
        </div>
    );
}
