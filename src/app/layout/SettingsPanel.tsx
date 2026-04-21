import { useState } from 'react';
import type { ModuleConfigState } from '../../sim/types/simTypes';

type Props = {
  moduleConfig: ModuleConfigState;
  onToggleModule: (moduleId: string, enabled: boolean) => void;
};

export function SettingsPanel({ moduleConfig, onToggleModule }: Props) {
  const [open, setOpen] = useState(false);
  const activeCount = moduleConfig.modules.filter((module) => module.enabled).length;

  return (
    <section className="settings-panel">
      <button type="button" className="settings-toggle" onClick={() => setOpen((value) => !value)}>
        Settings - Modules ({activeCount} active)
      </button>

      {open ? (
        <div className="settings-body">
          {moduleConfig.modules.map((module) => (
            <label key={module.id} className="settings-module-item">
              <input
                type="checkbox"
                checked={module.enabled}
                onChange={(event) => onToggleModule(module.id, event.target.checked)}
              />
              <div>
                <strong>{module.name}</strong>
                <small>{module.description ?? 'No description provided.'}</small>
              </div>
            </label>
          ))}
        </div>
      ) : null}
    </section>
  );
}
