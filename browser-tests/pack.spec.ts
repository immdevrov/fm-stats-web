import { test, expect } from '@playwright/test';
import { parseCustomDate } from '../src/utils/utils';

test('parseCustomDate reads the month as written', () => {
  const january = parseCustomDate('24/01/2035');
  expect(january.getFullYear()).toBe(2035);
  expect(january.getMonth()).toBe(0);
  expect(january.getDate()).toBe(24);
});

test('parseCustomDate does not roll December into the next year', () => {
  const december = parseCustomDate('31/12/2035');
  expect(december.getFullYear()).toBe(2035);
  expect(december.getMonth()).toBe(11);
  expect(december.getDate()).toBe(31);
});
