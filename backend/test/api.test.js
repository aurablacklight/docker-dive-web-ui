const express = require('express');
const request = require('supertest');

// Test the actual app instance
let app;
let server;

beforeAll(async () => {
  // Import the app and server
  const serverModule = require('../server');
  app = serverModule.app;
  server = serverModule.server;
  
  // Wait a moment for the server to initialize
  await new Promise(resolve => setTimeout(resolve, 500));
});

describe('🧪 Backend Health and API Tests', () => {
  
  describe('🏥 Health Endpoint', () => {
    test('should return 200 and healthy status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
        
      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        environment: expect.any(String)
      });
    });
    
    test('should include system information', async () => {
      const response = await request(app)
        .get('/api/health');
        
      expect(response.body.system).toBeDefined();
      expect(response.body.system.memory).toBeDefined();
      expect(response.body.system.platform).toBeDefined();
    });
  });
  
  describe('🔍 Search Endpoint', () => {
    test('should handle search requests', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'alpine', limit: 5 })
        .expect(200);
        
      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
    });
    
    test('should handle empty search gracefully', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: '', limit: 5 })
        .expect(400);
        
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('🐳 Docker Integration', () => {
    test('should verify docker availability', async () => {
      // This tests that our container can access Docker
      const response = await request(app)
        .get('/api/health');
        
      expect(response.body.docker).toBeDefined();
      expect(response.body.docker.available).toBe(true);
    });
  });
  
  describe('🔒 Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health');
        
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('content-security-policy');
    });
  });
  
  describe('📊 Performance', () => {
    test('health endpoint should respond quickly', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/api/health')
        .expect(200);
        
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });
  });
});

afterAll(async () => {
  // Clean up server connection
  if (server && server.listening) {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
});
