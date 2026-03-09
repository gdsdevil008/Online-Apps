#!/bin/bash
echo "🚀 Starting Devil MCP Server automatically..."

# Navigate to project directory
cd /workspaces/Online-Apps/Devil-mcpl-server

# Check if server is already running
if pgrep -f "python src/server.py --stdio" > /dev/null; then
    echo "✅ MCP Server already running"
else
    echo "Starting MCP Server in background..."
    
    # Start the server in background and save PID
    nohup python src/server.py --stdio > mcp-server.log 2>&1 &
    echo $! > mcp-server.pid
    
    echo "✅ MCP Server started with PID $(cat mcp-server.pid)"
    echo "📝 Logs: tail -f mcp-server.log"
fi
