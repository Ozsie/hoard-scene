import { describe, expect, it } from 'vitest';
import { colorWithAlpha, gradientStopColor } from './colors';

describe('colorWithAlpha', () => {
  it('applies alpha to six-digit hex', () => {
    expect(colorWithAlpha('#FFB85C', 0.5)).toBe('rgba(255, 184, 92, 0.5)');
  });

  it('expands three-digit hex', () => {
    expect(colorWithAlpha('#abc', 1)).toBe('rgba(170, 187, 204, 1)');
  });

  it('multiplies the embedded alpha of eight-digit hex', () => {
    expect(colorWithAlpha('#ffb85c80', 0.5)).toBe(
      `rgba(255, 184, 92, ${0.5 * (0x80 / 255)})`,
    );
  });

  it('parses rgb() and rgba() forms, numbers and percentages', () => {
    expect(colorWithAlpha('rgb(255, 184, 92)', 0.5)).toBe(
      'rgba(255, 184, 92, 0.5)',
    );
    expect(colorWithAlpha('rgba(100%, 50%, 0%, 0.5)', 0.5)).toBe(
      'rgba(255, 128, 0, 0.25)',
    );
    expect(colorWithAlpha('rgb(255 184 92)', 0.5)).toBeNull();
  });

  it('clamps alpha into [0, 1]', () => {
    expect(colorWithAlpha('#ffffff', 7)).toBe('rgba(255, 255, 255, 1)');
    expect(colorWithAlpha('#ffffff', -2)).toBe('rgba(255, 255, 255, 0)');
  });

  it('returns null for named and unsupported colors', () => {
    expect(colorWithAlpha('red', 0.5)).toBeNull();
    expect(colorWithAlpha('linear-gradient(red, blue)', 0.5)).toBeNull();
    expect(colorWithAlpha('#12345', 0.5)).toBeNull();
    expect(colorWithAlpha('rgb(1, 2)', 0.5)).toBeNull();
    expect(colorWithAlpha('', 0.5)).toBeNull();
  });
});

describe('gradientStopColor', () => {
  it('delegates to colorWithAlpha for supported forms', () => {
    expect(gradientStopColor('#abc', 0.25)).toBe('rgba(170, 187, 204, 0.25)');
  });

  it('keeps fully transparent stops transparent for any color form', () => {
    expect(gradientStopColor('red', 0)).toBe('rgba(0, 0, 0, 0)');
    expect(gradientStopColor('#ffb85c', 0)).toBe('rgba(255, 184, 92, 0)');
  });

  it('falls back to the raw color for named colors with alpha', () => {
    expect(gradientStopColor('red', 0.5)).toBe('red');
  });
});
