import { BriefcaseBusiness, Plus } from 'lucide-react';

export default function RolesPage() {
  return (
    <div className="clients-page recruit-clients-page">
      <div className="recruit-page-header">
        <div>
          <h1>Roles</h1>
          <p>Manage open roles you're hiring for</p>
        </div>
        <div className="recruit-header-actions">
          <button className="recruit-blue-btn"><Plus size={16} /> Add role</button>
        </div>
      </div>
      <div className="recruit-empty">
        <div className="recruit-empty-icon"><BriefcaseBusiness size={33} /></div>
        <h3>No roles yet</h3>
        <p>Create your first role to start sourcing candidates and tracking pipeline progress.</p>
        <button className="recruit-blue-btn"><Plus size={14} /> Add role</button>
      </div>
    </div>
  );
}
