#!/usr/bin/env node

/**
 * Simple MCP Server Test
 * 
 * This script manually tests the MCP server by sending JSON-RPC messages
 * to the server's stdin and reading responses from stdout.
 */

import { spawn } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SimpleTest {
  constructor() {
    this.serverProcess = null;
    this.messageId = 1;
  }

  /**
   * Start the MCP server
   */
  async startServer() {
    const serverPath = resolve(__dirname, './dist/server.js');
    console.log(`🚀 Starting MCP server: ${serverPath}`);
    
    this.serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: __dirname
    });

    this.serverProcess.stderr.on('data', (data) => {
      console.log(`[Server stderr] ${data.toString().trim()}`);
    });

    this.serverProcess.on('exit', (code) => {
      console.log(`[Server] Process exited with code ${code}`);
    });

    // Give the server a moment to start
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Send a JSON-RPC message to the server
   */
  async sendMessage(method, params = {}) {
    const message = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: method,
      params: params
    };

    const messageStr = JSON.stringify(message) + '\n';
    console.log(`📤 Sending: ${method}`);
    console.log(`   Message: ${messageStr.trim()}`);

    this.serverProcess.stdin.write(messageStr);

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, 5000);

      let responseData = '';
      
      const onData = (data) => {
        responseData += data.toString();
        
        // Check if we have a complete JSON response
        try {
          const lines = responseData.split('\n').filter(line => line.trim());
          if (lines.length > 0) {
            const response = JSON.parse(lines[lines.length - 1]);
            if (response.id === message.id) {
              clearTimeout(timeout);
              this.serverProcess.stdout.removeListener('data', onData);
              resolve(response);
            }
          }
        } catch (e) {
          // Not a complete JSON yet, wait for more data
        }
      };

      this.serverProcess.stdout.on('data', onData);
    });
  }

  /**
   * Test MCP initialization
   */
  async testInitialize() {
    console.log('\n🔧 Testing MCP initialization...');
    
    try {
      const response = await this.sendMessage('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      });

      console.log('📥 Response:', JSON.stringify(response, null, 2));
      
      if (response.error) {
        console.error('❌ Initialize failed:', response.error);
        return false;
      }

      console.log('✅ Initialize successful');
      return true;
    } catch (error) {
      console.error('❌ Initialize failed:', error.message);
      return false;
    }
  }

  /**
   * Test listing resources
   */
  async testListResources() {
    console.log('\n📚 Testing list resources...');
    
    try {
      const response = await this.sendMessage('resources/list');
      
      console.log('📥 Response:', JSON.stringify(response, null, 2));
      
      if (response.error) {
        console.error('❌ List resources failed:', response.error);
        return false;
      }

      console.log(`✅ Found ${response.result.resources.length} resources`);
      return true;
    } catch (error) {
      console.error('❌ List resources failed:', error.message);
      return false;
    }
  }

  /**
   * Test listing tools
   */
  async testListTools() {
    console.log('\n🛠️  Testing list tools...');
    
    try {
      const response = await this.sendMessage('tools/list');
      
      console.log('📥 Response:', JSON.stringify(response, null, 2));
      
      if (response.error) {
        console.error('❌ List tools failed:', response.error);
        return false;
      }

      console.log(`✅ Found ${response.result.tools.length} tools`);
      return true;
    } catch (error) {
      console.error('❌ List tools failed:', error.message);
      return false;
    }
  }

  /**
   * Test calling a tool
   */
  async testCallTool() {
    console.log('\n⚙️  Testing tool call...');
    
    try {
      const response = await this.sendMessage('tools/call', {
        name: 'list_loaded_apps',
        arguments: {}
      });
      
      console.log('📥 Response:', JSON.stringify(response, null, 2));
      
      if (response.error) {
        console.error('❌ Tool call failed:', response.error);
        return false;
      }

      console.log('✅ Tool call successful');
      return true;
    } catch (error) {
      console.error('❌ Tool call failed:', error.message);
      return false;
    }
  }

  /**
   * Shutdown the server
   */
  async shutdown() {
    console.log('\n🔌 Shutting down...');
    
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      
      // Wait for server to shut down
      await new Promise((resolve) => {
        this.serverProcess.on('exit', resolve);
        setTimeout(resolve, 2000);
      });
      
      console.log('✅ Server stopped');
    }
  }

  /**
   * Run all tests
   */
  async runTests() {
    console.log('🧪 Simple MCP Server Test');
    console.log('==========================');
    
    try {
      await this.startServer();
      
      const initResult = await this.testInitialize();
      if (!initResult) {
        console.log('❌ Cannot proceed without successful initialization');
        return;
      }

      await this.testListResources();
      await this.testListTools();
      await this.testCallTool();
      
      console.log('\n✅ All tests completed');
      
    } catch (error) {
      console.error('💥 Test failed:', error.message);
    } finally {
      await this.shutdown();
    }
  }
}

// Run the test
const tester = new SimpleTest();
tester.runTests().catch(console.error);