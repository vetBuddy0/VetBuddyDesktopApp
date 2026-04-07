import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2, AlertCircle, CheckCircle, RotateCcw } from "lucide-react";
import { ezyvetConfigService } from "../services/ezyvetConfigService";
import { DEFAULT_EZYVET_RECORDS } from "../types/ezyvetConfig";
import type { EzyVetClinicalRecord } from "../types/ezyvetConfig";

interface EzyVetSettingsProps {
    onBack: () => void;
}

export function EzyVetSettings({ onBack }: EzyVetSettingsProps) {
    const [records, setRecords] = useState<EzyVetClinicalRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        setLoading(true);
        setError(null);
        try {
            const config = await ezyvetConfigService.getConfig();
            setRecords(config.records);
            setHasChanges(false);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load config";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (index: number) => {
        setRecords((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], enabled: !updated[index].enabled };
            return updated;
        });
        setHasChanges(true);
        setSuccess(null);
    };

    const handleAlternateNameChange = (index: number, value: string) => {
        setRecords((prev) => {
            const updated = [...prev];
            updated[index] = {
                ...updated[index],
                alternateName: value.trim() || null,
            };
            return updated;
        });
        setHasChanges(true);
        setSuccess(null);
    };

    const handleSelectorChange = (index: number, value: string) => {
        setRecords((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], inputFieldSelector: value.trim() };
            return updated;
        });
        setHasChanges(true);
        setSuccess(null);
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            await ezyvetConfigService.saveConfig(records);
            setSuccess("Configuration saved successfully!");
            setHasChanges(false);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to save config";
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setRecords(DEFAULT_EZYVET_RECORDS.map((r) => ({ ...r })));
        setHasChanges(true);
        setSuccess(null);
    };

    const enabledCount = records.filter((r) => r.enabled).length;

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <button
                    onClick={onBack}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Back"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h2 className="text-lg font-semibold">ezyVet Clinical Records</h2>
                    <p className="text-xs text-gray-500">
                        Configure which clinical records are active and their display names
                    </p>
                </div>
            </div>

            {/* Status Messages */}
            {error && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-red-800">{error}</span>
                </div>
            )}
            {success && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-green-800">{success}</span>
                </div>
            )}

            {/* Loading State */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="ml-2 text-sm text-gray-600">Loading configuration...</span>
                </div>
            ) : (
                <>
                    {/* Summary */}
                    <div className="mb-3 px-3 py-2 bg-blue-50 rounded-lg">
                        <span className="text-sm text-blue-800">
                            <strong>{enabledCount}</strong> of {records.length} records enabled
                        </span>
                    </div>

                    {/* Records List */}
                    <div className="space-y-2 mb-4 max-h-[calc(100vh-280px)] overflow-y-auto">
                        {records.map((record, index) => (
                            <div
                                key={record.name}
                                className={`border rounded-lg p-3 transition-colors ${record.enabled
                                    ? "border-blue-200 bg-white"
                                    : "border-gray-200 bg-gray-50 opacity-75"
                                    }`}
                            >
                                {/* Row 1: Name + Toggle */}
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-sm">{record.name}</span>
                                    <button
                                        onClick={() => handleToggle(index)}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${record.enabled ? "bg-blue-600" : "bg-gray-300"
                                            }`}
                                        title={record.enabled ? "Disable" : "Enable"}
                                    >
                                        <span
                                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${record.enabled ? "translate-x-4" : "translate-x-0.5"
                                                }`}
                                        />
                                    </button>
                                </div>

                                {/* Row 2: Alternate Name + Selector (only if enabled) */}
                                {record.enabled && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">
                                                Alternate Name
                                            </label>
                                            <input
                                                type="text"
                                                value={record.alternateName || ""}
                                                onChange={(e) =>
                                                    handleAlternateNameChange(index, e.target.value)
                                                }
                                                placeholder="Same as original"
                                                className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">
                                                Input Field Selector
                                            </label>
                                            <input
                                                type="text"
                                                value={record.inputFieldSelector}
                                                onChange={(e) =>
                                                    handleSelectorChange(index, e.target.value)
                                                }
                                                placeholder="textarea name attr"
                                                className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="sticky bottom-0 bg-white pt-2 border-t space-y-2">
                        <button
                            onClick={handleSave}
                            disabled={saving || !hasChanges}
                            className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Configuration
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleReset}
                            className="w-full py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg flex items-center justify-center gap-2 transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reset to Defaults
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
