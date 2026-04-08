import { useState, useEffect } from 'react';
import { templateService } from '../services/templateService';
import type { SOAPTemplate } from '../types/soapTemplate';
import { FileText, Plus, Edit, Trash2, Star, Loader2, X, Save } from 'lucide-react';

export function TemplateManager() {
  const [templates, setTemplates] = useState<SOAPTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SOAPTemplate | null>(null);
  
  // Refactored formData to handle metadata and an array of sections
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sections: [] as Array<{
      id: string;
      title: string;
      instructions: string;
      placeholder: string;
      order: number;
    }>
  });

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true); setError(null);
      const data = await templateService.getAll();
      setTemplates(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const getInitialSections = () => [
    { id: 'subjective', title: 'Subjective', instructions: 'Include the main reason for the visit.', placeholder: 'E.g., Owner reports...', order: 0 },
    { id: 'objective', title: 'Objective', instructions: 'Document physical examination findings.', placeholder: 'E.g., Physical examination reveals...', order: 1 },
    { id: 'assessment', title: 'Assessment', instructions: 'Provide working diagnosis.', placeholder: 'E.g., Clinical assessment...', order: 2 },
    { id: 'plan', title: 'Plan', instructions: 'Detail treatment plan.', placeholder: 'E.g., Treatment plan includes...', order: 3 },
  ];

  const openCreateModal = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      sections: getInitialSections(),
    });
    setShowModal(true);
  };

  const openEditModal = (template: SOAPTemplate) => {
    setEditingTemplate(template);
    
    // Support both legacy object-based and current array-based sections during transition
    let sectionsArray: any[] = [];
    const definition = template.templateDefinition;
    
    if (Array.isArray(definition.sections)) {
      sectionsArray = definition.sections.map(s => ({
        id: s.id,
        title: s.title,
        instructions: s.instructions || '',
        placeholder: s.placeholder || '',
        order: s.order ?? 0
      }));
    } else if (typeof definition.sections === 'object') {
      // Legacy conversion if needed
      sectionsArray = Object.entries(definition.sections).map(([key, val]: [string, any]) => ({
        id: key,
        title: val.title || key,
        instructions: val.instructions || '',
        placeholder: val.placeholder || '',
        order: 0 // Will be fixed on save
      }));
    }

    setFormData({
      name: template.name,
      description: template.description || '',
      sections: sectionsArray.length > 0 ? sectionsArray : getInitialSections(),
    });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingTemplate(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Construct the backend-compatible array-based structure (Version 1 as per zod schema)
    const templateDefinition: any = {
      version: 1, // Align with backend version
      name: formData.name,
      description: formData.description,
      sections: formData.sections.map((s, index) => ({
        id: s.id || `section-${index}`,
        title: s.title,
        instructions: s.instructions,
        placeholder: s.placeholder,
        order: index
      })),
      metadata: { 
        createdBy: 'user', 
        createdAt: editingTemplate?.templateDefinition?.metadata?.createdAt || new Date().toISOString() 
      },
    };

    try {
      setLoading(true); setError(null);
      if (editingTemplate) {
        await templateService.update(editingTemplate.id, { 
          name: formData.name, 
          description: formData.description, 
          templateDefinition 
        } as any);
        setSuccess('Template updated!');
      } else {
        await templateService.create({ 
          name: formData.name, 
          description: formData.description, 
          templateDefinition 
        } as any);
        setSuccess('Template created!');
      }
      await loadTemplates();
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this template?')) return;
    try {
      setLoading(true); setError(null);
      await templateService.delete(id);
      setSuccess('Template deleted');
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to delete template');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      setLoading(true); setError(null);
      await templateService.setDefault(id);
      setSuccess('Default template set!');
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to set default');
    } finally {
      setLoading(false);
    }
  };

  const handleUnsetDefault = async (id: number) => {
    if (!confirm('Remove this template as the default? No default will be selected.')) return;
    try {
      setLoading(true); setError(null);
      await templateService.update(id, { isDefault: false } as any);
      setSuccess('Default removed.');
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to remove default');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Templates</h2>
          <p style={{ fontSize: 11.5, color: 'var(--color-muted-foreground)', marginTop: 2 }}>
            Custom AI instruction sets for SOAP notes
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={openCreateModal} className="btn btn-primary btn-sm">
            <Plus size={13} />
            New
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error">
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} className="btn-icon" style={{ flexShrink: 0 }}><X size={13} /></button>
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          <span style={{ flex: 1 }}>{success}</span>
          <button onClick={() => setSuccess(null)} className="btn-icon" style={{ flexShrink: 0 }}><X size={13} /></button>
        </div>
      )}

      {/* Templates List */}
      {loading && templates.length === 0 ? (
        <div className="empty-state">
          <div className="spinner" style={{ width: 24, height: 24 }} />
          <span style={{ fontSize: 12 }}>Loading templates...</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FileText size={22} /></div>
          <span className="empty-state-title">No templates yet</span>
          <span className="empty-state-desc">Create a custom template to get started.</span>
          <button onClick={openCreateModal} className="btn btn-primary btn-sm" style={{ marginTop: 4 }}>
            <Plus size={13} /> Create Template
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {templates.map((template) => (
            <div key={template.id} className="card card-hover slide-in" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-foreground)' }}>
                      {template.name}
                    </h3>
                    {template.isDefault && (
                      <span className="badge badge-warning" style={{ gap: 4, padding: '2px 8px' }}>
                        <Star size={10} fill="currentColor" /> Default
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <p style={{ fontSize: 13, color: 'var(--color-muted-foreground)', marginBottom: 12, lineHeight: 1.5 }}>
                      {template.description}
                    </p>
                  )}
                  
                  {/* Sections Preview */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(Array.isArray(template.templateDefinition?.sections) 
                      ? template.templateDefinition.sections 
                      : []
                    ).map((s: any) => (
                      <span key={s.id} style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        background: 'var(--color-muted)', color: 'var(--color-foreground)',
                        border: '1px solid var(--color-border)', textTransform: 'uppercase'
                      }}>
                        {s.title}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, marginLeft: 16 }}>
                  {template.isDefault ? (
                    <button onClick={() => handleUnsetDefault(template.id)} disabled={loading} className="btn-icon warning" title="Remove as default">
                      <Star size={14} fill="currentColor" />
                    </button>
                  ) : (
                    <button onClick={() => handleSetDefault(template.id)} disabled={loading} className="btn-icon" title="Set as default">
                      <Star size={14} />
                    </button>
                  )}
                  <button onClick={() => openEditModal(template)} className="btn-icon primary" title="Edit Template">
                    <Edit size={14} />
                  </button>
                  <button onClick={() => handleDelete(template.id)} disabled={loading} className="btn-icon danger" title="Delete Template">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '40px 16px', zIndex: 100, overflowY: 'auto'
        }}>
          <div style={{
            background: 'var(--color-background)', borderRadius: 16, width: '100%', maxWidth: 550,
            border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-xl)',
            animation: 'scaleIn 0.2s ease-out'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-muted)', borderRadius: '16px 16px 0 0'
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-foreground)' }}>
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </h2>
              <button onClick={closeModal} className="btn-icon"><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="input-group">
                  <label className="input-label">Template Name *</label>
                  <input
                    type="text" required value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input" placeholder="e.g., Dental Consultation"
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input" placeholder="What is this template for?"
                    style={{ minHeight: 60 }}
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--color-foreground)' }}>Sections & AI Instructions</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {formData.sections.map((section, idx) => (
                    <div key={idx} style={{ 
                      padding: '14px', background: 'var(--color-card)', 
                      borderRadius: 12, border: '1px solid var(--color-border)',
                      display: 'flex', flexDirection: 'column', gap: 10
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ 
                          width: 24, height: 24, borderRadius: 6, background: 'var(--color-primary)', 
                          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700
                        }}>
                          {idx + 1}
                        </div>
                        <input
                          type="text" value={section.title}
                          onChange={(e) => {
                            const newSections = [...formData.sections];
                            newSections[idx].title = e.target.value;
                            setFormData({ ...formData, sections: newSections });
                          }}
                          className="input" style={{ fontWeight: 600, border: 'none', background: 'transparent', padding: '2px 0' }}
                          placeholder="Section Title"
                        />
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted-foreground)' }}>AI INSTRUCTIONS</label>
                        <textarea
                          value={section.instructions}
                          onChange={(e) => {
                            const newSections = [...formData.sections];
                            newSections[idx].instructions = e.target.value;
                            setFormData({ ...formData, sections: newSections });
                          }}
                          className="input" style={{ minHeight: 70, fontSize: 12.5 }}
                          placeholder="Tell the AI what to document in this section..."
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-muted-foreground)' }}>UI PLACEHOLDER</label>
                        <input
                          type="text" value={section.placeholder}
                          onChange={(e) => {
                            const newSections = [...formData.sections];
                            newSections[idx].placeholder = e.target.value;
                            setFormData({ ...formData, sections: newSections });
                          }}
                          className="input" style={{ fontSize: 12.5 }}
                          placeholder="Visible when empty..."
                        />
                      </div>
                    </div>
                  ))}
                  
                  {/* Future: Add Section Button */}
                  <button 
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        sections: [...formData.sections, { id: `custom-${Date.now()}`, title: 'New Section', instructions: '', placeholder: '', order: formData.sections.length }]
                      });
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 4, width: 'fit-content' }}
                  >
                    <Plus size={13} /> Add Section
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={closeModal} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 1 }}>
                  {loading ? <><Loader2 size={14} className="spin" /> Saving...</> : <><Save size={14} /> {editingTemplate ? 'Update Template' : 'Create Template'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
