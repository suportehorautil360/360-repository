import { beforeEach, describe, expect, it } from 'vitest';
import { provisionarChassisEmpresa, resolverChassiOffline, removerChassisEmpresa, limparExpirados } from './chassis-offline';

beforeEach(() => { localStorage.clear(); });

describe('chassis-offline', () => {
  it('provisiona e resolve chassi normalizado', () => {
    provisionarChassisEmpresa({ empresaId: 'e1', empresaNome: 'Emp 1', chassis: ['aaa', 'BBB'], expiraEm: new Date(Date.now()+1000).toISOString() });
    expect(resolverChassiOffline('AAA')).toEqual({ empresaId: 'e1', empresaNome: 'Emp 1' });
    expect(resolverChassiOffline('  bbb ')).toEqual({ empresaId: 'e1', empresaNome: 'Emp 1' });
    expect(resolverChassiOffline('ccc')).toBeNull();
  });
  it('multi-empresa: encontra em qualquer uma', () => {
    provisionarChassisEmpresa({ empresaId: 'e1', empresaNome: 'Emp 1', chassis: ['X1'], expiraEm: new Date(Date.now()+1000).toISOString() });
    provisionarChassisEmpresa({ empresaId: 'e2', empresaNome: 'Emp 2', chassis: ['Y1'], expiraEm: new Date(Date.now()+1000).toISOString() });
    expect(resolverChassiOffline('X1')?.empresaId).toBe('e1');
    expect(resolverChassiOffline('Y1')?.empresaId).toBe('e2');
  });
  it('expirado NÃO resolve', () => {
    provisionarChassisEmpresa({ empresaId: 'e1', empresaNome: 'Emp 1', chassis: ['Z'], expiraEm: new Date(Date.now()-1000).toISOString() });
    expect(resolverChassiOffline('Z')).toBeNull();
  });
  it('remover empresa limpa só ela', () => {
    provisionarChassisEmpresa({ empresaId: 'e1', empresaNome: 'Emp 1', chassis: ['X'], expiraEm: new Date(Date.now()+1000).toISOString() });
    provisionarChassisEmpresa({ empresaId: 'e2', empresaNome: 'Emp 2', chassis: ['Y'], expiraEm: new Date(Date.now()+1000).toISOString() });
    removerChassisEmpresa('e1');
    expect(resolverChassiOffline('X')).toBeNull();
    expect(resolverChassiOffline('Y')).not.toBeNull();
  });
  it('limparExpirados remove só expiradas', () => {
    provisionarChassisEmpresa({ empresaId: 'e1', empresaNome: 'V', chassis: ['V'], expiraEm: new Date(Date.now()+1000).toISOString() });
    provisionarChassisEmpresa({ empresaId: 'e2', empresaNome: 'E', chassis: ['E'], expiraEm: new Date(Date.now()-1000).toISOString() });
    limparExpirados();
    expect(resolverChassiOffline('V')).not.toBeNull();
    expect(resolverChassiOffline('E')).toBeNull();
  });
});
