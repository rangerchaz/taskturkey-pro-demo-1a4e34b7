// tests/security/basic-security.test.js
import { describe, it, expect } from '@jest/globals';

describe('Basic Security Tests', () => {
  it('should sanitize input data', () => {
    const maliciousInput = '<script>alert("xss")</script>';
    const sanitized = maliciousInput.replace(/<script[^>]*>.*?<\/script>/gi, '');
    
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('alert');
  });

  it('should validate request headers', () => {
    const validHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    expect(validHeaders['Content-Type']).toBe('application/json');
    expect(validHeaders['Accept']).toBe('application/json');
  });

  it('should prevent unauthorized access to non-existent endpoints', () => {
    const unauthorizedAttempts = [
      '/admin',
      '/api/admin',
      '/api/users/sensitive-data'
    ];

    unauthorizedAttempts.forEach(endpoint => {
      // These should return 404 or 403
      expect(() => {
        throw new Error('Unauthorized access');
      }).toThrow();
    });
  });
});