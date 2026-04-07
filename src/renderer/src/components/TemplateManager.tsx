import { useState, useEffect } from 'react';
import { templateService } from '../services/templateService';
import type { SOAPTemplate, SoapTemplateDefinitionV2 } from '../types/soapTemplate';
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Star,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Save,
} from 'lucide-react';

export function TemplateManager() {
  const [templates, setTemplates] = useState<SOAPTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create/Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SOAPTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subjectiveInstructions: '',
    subjectivePlaceholder: '',
    objectiveInstructions: '',
    objectivePlaceholder: '',
    assessmentInstructions: '',
    assessmentPlaceholder: '',
    planInstructions: '',
    planPlaceholder: '',
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await templateService.getAll();
      setTemplates(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      subjectiveInstructions: '',
      subjectivePlaceholder: 'E.g., Owner reports...',
      objectiveInstructions: '',
      objectivePlaceholder: 'E.g., Physical examination reveals...',
      assessmentInstructions: '',
      assessmentPlaceholder: 'E.g., Clinical assessment...',
      planInstructions: '',
      planPlaceholder: 'E.g., Treatment plan includes...',
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (template: SOAPTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      subjectiveInstructions: template.templateDefinition.sections.subjective.instructions,
      subjectivePlaceholder: template.templateDefinition.sections.subjective.placeholder || '',
      objectiveInstructions: template.templateDefinition.sections.objective.instructions,
      objectivePlaceholder: template.templateDefinition.sections.objective.placeholder || '',
      assessmentInstructions: template.templateDefinition.sections.assessment.instructions,
      assessmentPlaceholder: template.templateDefinition.sections.assessment.placeholder || '',
      planInstructions: template.templateDefinition.sections.plan.instructions,
      planPlaceholder: template.templateDefinition.sections.plan.placeholder || '',
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const templateDefinition: SoapTemplateDefinitionV2 = {
      version: 2,
      name: formData.name,
      description: formData.description,
      sections: {
        subjective: {
          title: 'Subjective',
          instructions: formData.subjectiveInstructions || "Include the main reason for the visit as described by the owner.",
          placeholder: formData.subjectivePlaceholder,
        },
        objective: {
          title: 'Objective',
          instructions: formData.objectiveInstructions || "Document all physical examination findings including vital signs.",
          placeholder: formData.objectivePlaceholder,
        },
        assessment: {
          title: 'Assessment',
          instructions: formData.assessmentInstructions || "Provide the working diagnosis or assessment based on findings.",
          placeholder: formData.assessmentPlaceholder,
        },
        plan: {
          title: 'Plan',
          instructions: formData.planInstructions || "Detail the treatment plan including diagnostics and medications.",
          placeholder: formData.planPlaceholder,
        },
      },
      metadata: {
        createdBy: 'user',
        createdAt: new Date().toISOString(),
      },
    };

    try {
      setLoading(true);
      setError(null);

      if (editingTemplate) {
        await templateService.update(editingTemplate.id, {
          name: formData.name,
          description: formData.description,
          templateDefinition,
        });
        setSuccess('Template updated successfully!');
      } else {
        await templateService.create({
          name: formData.name,
          description: formData.description,
          templateDefinition,
        });
        setSuccess('Template created successfully!');
      }

      await loadTemplates();
      handleCloseModal();
    } catch (err: any) {
      setError(err.message || 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await templateService.delete(id);
      setSuccess('Template deleted successfully!');
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to delete template');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      await templateService.setDefault(id);
      setSuccess('Default template set!');
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to set default template');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDefaults = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await templateService.seedDefaults();
      setSuccess(`Added ${result.created.length} templates, skipped ${result.skipped} existing`);
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to seed templates');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">SOAP Templates</h1>
        <p className="text-sm text-muted">
          Create custom templates with instructions for AI-generated SOAP notes
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={handleOpenCreateModal}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
        <button
          onClick={handleSeedDefaults}
          disabled={loading}
          className="btn btn-outline flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Seed Default Templates
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-lg flex items-center gap-2 text-destructive">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500 rounded-lg flex items-center gap-2 text-emerald-700">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Templates Grid */}
      {loading && templates.length === 0 ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted" />
          <p className="text-muted">Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted" />
          <p className="text-muted mb-4">No templates yet</p>
          <button onClick={handleOpenCreateModal} className="btn btn-primary">
            Create Your First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    {template.name}
                    {template.isDefault && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-700 text-xs rounded-full">
                        <Star className="w-3 h-3" />
                        Default
                      </span>
                    )}
                  </h3>
                  {template.description && (
                    <p className="text-sm text-muted mt-1">{template.description}</p>
                  )}
                </div>
              </div>

              <div className="text-xs text-muted mb-3">
                <div className="inline-block px-2 py-1 bg-primary/10 text-primary rounded">
                  V2 - Instruction-based
                </div>
              </div>

              <div className="flex gap-2">
                {!template.isDefault && (
                  <button
                    onClick={() => handleSetDefault(template.id)}
                    className="btn btn-outline btn-sm flex-1 text-xs"
                    disabled={loading}
                  >
                    <Star className="w-3 h-3 mr-1" />
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => handleOpenEditModal(template)}
                  className="btn btn-outline btn-sm flex-1 text-xs"
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="btn btn-outline btn-sm text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  disabled={loading}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </h2>
              <button onClick={handleCloseModal} className="text-muted hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Basic Info */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input w-full"
                  required
                  placeholder="E.g., General Consultation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input w-full"
                  placeholder="Brief description of when to use this template"
                />
              </div>

              {/* Subjective Section */}
              <div className="border border-border rounded-lg p-3">
                <h3 className="font-semibold text-sm text-foreground mb-2">Subjective Section</h3>
                <label className="block text-sm text-muted mb-1">Instructions for AI</label>
                <textarea
                  value={formData.subjectiveInstructions}
                  onChange={(e) => setFormData({ ...formData, subjectiveInstructions: e.target.value })}
                  className="input w-full min-h-[80px]"
                  placeholder="E.g., Include owner's observations, history, and concerns..."
                />
                <label className="block text-sm text-muted mb-1 mt-2">Placeholder text (optional)</label>
                <input
                  type="text"
                  value={formData.subjectivePlaceholder}
                  onChange={(e) => setFormData({ ...formData, subjectivePlaceholder: e.target.value })}
                  className="input w-full"
                  placeholder="E.g., Owner reports..."
                />
              </div>

              {/* Objective Section */}
              <div className="border border-border rounded-lg p-3">
                <h3 className="font-semibold text-sm text-foreground mb-2">Objective Section</h3>
                <label className="block text-sm text-muted mb-1">Instructions for AI</label>
                <textarea
                  value={formData.objectiveInstructions}
                  onChange={(e) => setFormData({ ...formData, objectiveInstructions: e.target.value })}
                  className="input w-full min-h-[80px]"
                  placeholder="E.g., Document physical exam findings, vital signs..."
                />
                <label className="block text-sm text-muted mb-1 mt-2">Placeholder text (optional)</label>
                <input
                  type="text"
                  value={formData.objectivePlaceholder}
                  onChange={(e) => setFormData({ ...formData, objectivePlaceholder: e.target.value })}
                  className="input w-full"
                  placeholder="E.g., Physical examination reveals..."
                />
              </div>

              {/* Assessment Section */}
              <div className="border border-border rounded-lg p-3">
                <h3 className="font-semibold text-sm text-foreground mb-2">Assessment Section</h3>
                <label className="block text-sm text-muted mb-1">Instructions for AI</label>
                <textarea
                  value={formData.assessmentInstructions}
                  onChange={(e) => setFormData({ ...formData, assessmentInstructions: e.target.value })}
                  className="input w-full min-h-[80px]"
                  placeholder="E.g., Provide working diagnosis, differential diagnoses..."
                />
                <label className="block text-sm text-muted mb-1 mt-2">Placeholder text (optional)</label>
                <input
                  type="text"
                  value={formData.assessmentPlaceholder}
                  onChange={(e) => setFormData({ ...formData, assessmentPlaceholder: e.target.value })}
                  className="input w-full"
                  placeholder="E.g., Clinical assessment..."
                />
              </div>

              {/* Plan Section */}
              <div className="border border-border rounded-lg p-3">
                <h3 className="font-semibold text-sm text-foreground mb-2">Plan Section</h3>
                <label className="block text-sm text-muted mb-1">Instructions for AI</label>
                <textarea
                  value={formData.planInstructions}
                  onChange={(e) => setFormData({ ...formData, planInstructions: e.target.value })}
                  className="input w-full min-h-[80px]"
                  placeholder="E.g., Detail treatment plan, medications, follow-up..."
                />
                <label className="block text-sm text-muted mb-1 mt-2">Placeholder text (optional)</label>
                <input
                  type="text"
                  value={formData.planPlaceholder}
                  onChange={(e) => setFormData({ ...formData, planPlaceholder: e.target.value })}
                  className="input w-full"
                  placeholder="E.g., Treatment plan includes..."
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn btn-outline flex-1"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {editingTemplate ? 'Update Template' : 'Create Template'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
