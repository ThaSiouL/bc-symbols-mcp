#!/usr/bin/env node

/**
 * Manual MCP Server Test Script
 * 
 * This script validates that the MCP server responds correctly to basic protocol messages.
 * It spawns the server process and sends JSON-RPC messages via stdio.
 */

import { spawn } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MCPServerTester {
  constructor() {
    this.serverProcess = null;
    this.messageId = 1;
    this.testResults = [];
  }

  /**
   * Start the MCP server process
   */
  async startServer() {
    const serverPath = resolve(__dirname, '../dist/server.js');
    this.log('info', `🚀 Starting MCP server: ${serverPath}`);
    
    this.serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: resolve(__dirname, '..')
    });

    // Capture server stderr for logging
    this.serverProcess.stderr.on('data', (data) => {
      this.log('server', `${data.toString().trim()}`);
    });

    // Handle server exit
    this.serverProcess.on('exit', (code) => {
      this.log('info', `Server process exited with code ${code}`);
    });

    // Handle server errors
    this.serverProcess.on('error', (error) => {
      this.log('error', `Server process error: ${error.message}`);
    });

    // Give the server a moment to start
    await this.sleep(500);
  }

  /**
   * Send a JSON-RPC message to the server and wait for response
   */
  async sendMessage(method, params = {}, timeout = 10000) {
    const message = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: method,
      params: params
    };

    const messageStr = JSON.stringify(message) + '\n';
    this.log('send', `📤 ${method}`);
    this.log('debug', `   ${messageStr.trim()}`);

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.serverProcess.stdout.removeAllListeners('data');
        reject(new Error(`Response timeout for ${method}`));
      }, timeout);

      let responseData = '';
      
      const onData = (data) => {
        responseData += data.toString();
        
        // Try to parse complete JSON responses
        const lines = responseData.split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const response = JSON.parse(line);
            if (response.id === message.id) {
              clearTimeout(timeoutHandle);
              this.serverProcess.stdout.removeListener('data', onData);
              this.log('receive', `📥 ${method} response`);
              this.log('debug', `   ${JSON.stringify(response, null, 2)}`);
              resolve(response);
              return;
            }
          } catch (e) {
            // Not a complete JSON yet, continue
          }
        }
      };

      this.serverProcess.stdout.on('data', onData);
      this.serverProcess.stdin.write(messageStr);
    });
  }

  /**
   * Test MCP initialization handshake
   */
  async testInitialize() {
    this.log('test', '🔧 Testing MCP initialization...');
    
    try {
      const response = await this.sendMessage('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: { listChanged: true },
          sampling: {}
        },
        clientInfo: {
          name: 'mcp-test-client',
          version: '1.0.0'
        }
      });

      if (response.error) {
        this.addResult('Initialize', false, response.error.message);
        return false;
      }

      // Validate response structure
      const result = response.result;
      if (!result.protocolVersion || !result.capabilities || !result.serverInfo) {
        this.addResult('Initialize', false, 'Invalid response structure');
        return false;
      }

      // Send initialized notification
      await this.sendNotification('notifications/initialized');

      this.addResult('Initialize', true, `Server: ${result.serverInfo.name} v${result.serverInfo.version}`);
      return true;
    } catch (error) {
      this.addResult('Initialize', false, error.message);
      return false;
    }
  }

  /**
   * Send a notification (no response expected)
   */
  async sendNotification(method, params = {}) {
    const message = {
      jsonrpc: '2.0',
      method: method,
      params: params
    };

    const messageStr = JSON.stringify(message) + '\n';
    this.log('send', `📨 ${method} (notification)`);
    this.serverProcess.stdin.write(messageStr);
  }

  /**
   * Test listing available resources
   */
  async testListResources() {
    this.log('test', '📚 Testing list resources...');
    
    try {
      const response = await this.sendMessage('resources/list');
      
      if (response.error) {
        this.addResult('List Resources', false, response.error.message);
        return false;
      }

      const resources = response.result.resources;
      if (!Array.isArray(resources)) {
        this.addResult('List Resources', false, 'Resources is not an array');
        return false;
      }

      this.addResult('List Resources', true, `Found ${resources.length} resources`);
      return true;
    } catch (error) {
      this.addResult('List Resources', false, error.message);
      return false;
    }
  }

  /**
   * Test listing available tools
   */
  async testListTools() {
    this.log('test', '🛠️  Testing list tools...');
    
    try {
      const response = await this.sendMessage('tools/list');
      
      if (response.error) {
        this.addResult('List Tools', false, response.error.message);
        return false;
      }

      const tools = response.result.tools;
      if (!Array.isArray(tools)) {
        this.addResult('List Tools', false, 'Tools is not an array');
        return false;
      }

      // Validate tool structure
      for (const tool of tools) {
        if (!tool.name || !tool.description || !tool.inputSchema) {
          this.addResult('List Tools', false, 'Invalid tool structure');
          return false;
        }
      }

      this.addResult('List Tools', true, `Found ${tools.length} tools`);
      this.log('debug', `   Tools: ${tools.map(t => t.name).join(', ')}`);
      return true;
    } catch (error) {
      this.addResult('List Tools', false, error.message);
      return false;
    }
  }

  /**
   * Test calling a simple tool
   */
  async testCallTool() {
    this.log('test', '⚙️  Testing tool call...');
    
    try {
      const response = await this.sendMessage('tools/call', {
        name: 'list_loaded_apps',
        arguments: {}
      });
      
      if (response.error) {
        this.addResult('Call Tool', false, response.error.message);
        return false;
      }

      const content = response.result.content;
      if (!Array.isArray(content) || content.length === 0) {
        this.addResult('Call Tool', false, 'Invalid tool response content');
        return false;
      }

      // Parse the tool result
      const toolResult = JSON.parse(content[0].text);
      if (!toolResult.hasOwnProperty('success')) {
        this.addResult('Call Tool', false, 'Tool result missing success field');
        return false;
      }

      this.addResult('Call Tool', true, `Tool executed successfully`);
      return true;
    } catch (error) {
      this.addResult('Call Tool', false, error.message);
      return false;
    }
  }

  /**
   * Test error handling
   */
  async testErrorHandling() {
    this.log('test', '❌ Testing error handling...');
    
    try {
      // Test invalid method
      const response = await this.sendMessage('invalid/method');
      
      if (!response.error) {
        this.addResult('Error Handling', false, 'Expected error for invalid method');
        return false;
      }

      this.addResult('Error Handling', true, 'Properly handles invalid methods');
      return true;
    } catch (error) {
      this.addResult('Error Handling', false, error.message);
      return false;
    }
  }

  /**
   * Shutdown the server
   */
  async shutdown() {
    this.log('info', '🔌 Shutting down server...');
    
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      
      // Wait for server to shut down
      await new Promise((resolve) => {
        this.serverProcess.on('exit', resolve);
        setTimeout(resolve, 3000); // Force timeout after 3 seconds
      });
    }
  }

  /**
   * Add a test result
   */
  addResult(testName, success, message) {
    this.testResults.push({ testName, success, message });
    const status = success ? '✅' : '❌';
    this.log('result', `${status} ${testName}: ${message}`);
  }

  /**
   * Generate final test report
   */
  generateReport() {
    this.log('info', '\n📊 Test Results Summary');
    this.log('info', '========================');
    
    let passed = 0;
    let failed = 0;
    
    for (const result of this.testResults) {
      if (result.success) {
        passed++;
      } else {
        failed++;
      }
    }
    
    this.log('info', `Total: ${this.testResults.length} tests`);
    this.log('info', `Passed: ${passed}`);
    this.log('info', `Failed: ${failed}`);
    
    if (failed === 0) {
      this.log('info', '\n🎉 All tests passed! MCP server is working correctly.');
      return 0;
    } else {
      this.log('error', '\n💥 Some tests failed. Check the output above for details.');
      return 1;
    }
  }

  /**
   * Logging helper
   */
  log(type, message) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    let prefix;
    
    switch (type) {
      case 'info': prefix = 'ℹ️ '; break;
      case 'error': prefix = '❌'; break;
      case 'test': prefix = '🧪'; break;
      case 'send': prefix = '📤'; break;
      case 'receive': prefix = '📥'; break;
      case 'server': prefix = '🖥️ '; break;
      case 'result': prefix = '📊'; break;
      case 'debug': prefix = '🔍'; break;
      default: prefix = '  ';
    }
    
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 MCP Server Manual Test Script');
    console.log('================================\n');
    
    try {
      // Start server
      await this.startServer();
      
      // Run test sequence
      const initSuccess = await this.testInitialize();
      if (!initSuccess) {
        this.log('error', 'Cannot proceed without successful initialization');
        return await this.generateReport();
      }

      await this.testListResources();
      await this.testListTools();
      await this.testCallTool();
      await this.testErrorHandling();
      
      // Generate report
      return await this.generateReport();
      
    } catch (error) {
      this.log('error', `Test execution failed: ${error.message}`);
      return 1;
    } finally {
      await this.shutdown();
    }
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new MCPServerTester();
  tester.runAllTests()
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      console.error('💥 Fatal error:', error.message);
      process.exit(1);
    });
}