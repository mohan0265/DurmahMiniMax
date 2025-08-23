// Client/src/widget.tsx - Main widget export for drop-in usage
import React from 'react';
import { createRoot } from 'react-dom/client';
import DurmahWidget, { DurmahWidgetConfig } from './components/DurmahWidget';
import './index.css';

// Export the widget component for React applications
export { default as DurmahWidget } from './components/DurmahWidget';
export type { DurmahWidgetConfig } from './components/DurmahWidget';

// Export the hook for advanced usage
export { useRealtimeWebRTC } from './hooks/useRealtimeWebRTC';

// Vanilla JS integration function
export function initDurmahWidget(
  containerId: string, 
  config: DurmahWidgetConfig = {}
): { destroy: () => void } {
  const container = document.getElementById(containerId);
  
  if (!container) {
    throw new Error(`Container with id '${containerId}' not found`);
  }
  
  const root = createRoot(container);
  
  root.render(
    <React.StrictMode>
      <DurmahWidget {...config} />
    </React.StrictMode>
  );
  
  return {
    destroy: () => {
      root.unmount();
    }
  };
}

// Auto-initialize if data-durmah-widget attribute is found
if (typeof window !== 'undefined') {
  const autoInit = () => {
    const widgets = document.querySelectorAll('[data-durmah-widget]');
    
    widgets.forEach((element) => {
      const config = element.getAttribute('data-durmah-config');
      const parsedConfig: DurmahWidgetConfig = config ? JSON.parse(config) : {};
      
      // Create a container for the widget
      const container = document.createElement('div');
      container.id = `durmah-widget-${Math.random().toString(36).substr(2, 9)}`;
      element.appendChild(container);
      
      initDurmahWidget(container.id, parsedConfig);
    });
  };
  
  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
}

// Default export for convenience
export default DurmahWidget;