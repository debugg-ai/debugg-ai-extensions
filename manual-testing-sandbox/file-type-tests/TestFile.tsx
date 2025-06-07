import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Calculator from './test';

describe('Calculator', () => {
  let calculator;

  beforeEach(() => {
    calculator = new Calculator();
  });

  test('should initialize with zero', () => {
    expect(calculator.getResult()).toBe(0);
  });

  test('should add numbers correctly', () => {
    calculator.add(5).add(3);
    expect(calculator.getResult()).toBe(8);
  });

  test('should subtract numbers correctly', () => {
    calculator.add(10).subtract(4);
    expect(calculator.getResult()).toBe(6);
  });

  test('should multiply numbers correctly', () => {
    calculator.add(5).multiply(3);
    expect(calculator.getResult()).toBe(15);
  });

  test('should divide numbers correctly', () => {
    calculator.add(15).divide(3);
    expect(calculator.getResult()).toBe(5);
  });

  test('should throw error when dividing by zero', () => {
    expect(() => calculator.divide(0)).toThrow('Cannot divide by zero');
  });

  test('should reset to zero', () => {
    calculator.add(10);
    calculator.reset();
    expect(calculator.getResult()).toBe(0);
  });
});
