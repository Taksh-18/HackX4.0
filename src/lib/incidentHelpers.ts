import {
  Droplets,
  Flame,
  Car,
  Building2,
  Mountain,
  CloudLightning,
  AlertCircle,
} from 'lucide-react';
import type { IncidentType, ActionPriority } from '../data/types';

export function incidentTypeIcon(type: IncidentType) {
  switch (type) {
    case 'flood': return Droplets;
    case 'fire': return Flame;
    case 'accident': return Car;
    case 'structural': return Building2;
    case 'landslide': return Mountain;
    case 'weather': return CloudLightning;
    default: return AlertCircle;
  }
}

export function incidentTypeLabel(type: IncidentType): string {
  switch (type) {
    case 'flood': return 'Flood';
    case 'fire': return 'Fire';
    case 'accident': return 'Road Accident';
    case 'structural': return 'Structural Damage';
    case 'landslide': return 'Landslide';
    case 'weather': return 'Severe Weather';
    default: return 'Other';
  }
}

export function actionPriorityLabel(priority: ActionPriority): string {
  switch (priority) {
    case 'critical_dispatch': return 'CRITICAL DISPATCH';
    case 'deploy_scout': return 'DEPLOY SCOUT';
    case 'monitor': return 'MONITOR';
    case 'suppressed': return 'SUPPRESSED';
  }
}

export function actionPriorityColor(priority: ActionPriority): string {
  switch (priority) {
    case 'critical_dispatch': return 'bg-red-600 text-white';
    case 'deploy_scout': return 'bg-orange-500 text-white';
    case 'monitor': return 'bg-slate-200 text-slate-700';
    case 'suppressed': return 'bg-slate-100 text-slate-500';
  }
}
