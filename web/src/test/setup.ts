import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Le DOM est réinitialisé entre chaque test pour éviter les fuites d'état React.
afterEach(() => {
  cleanup();
});
