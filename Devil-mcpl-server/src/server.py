#!/usr/bin/env python3
"""
Devil MCP Server for GitHub Codespaces
Simple working version
"""

import os
import sys
import logging
import math
import stat
import platform
from datetime import datetime
from fastmcp import FastMCP

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("mcp-server")

# Create FastMCP instance with new name
mcp = FastMCP("Devil MCP Server")

# ============= TOOLS =============

@mcp.tool()
def calculate(expression: str) -> float:
    """
    Evaluate a mathematical expression safely.
    
    Args:
        expression: Mathematical expression as string (e.g., "2 + 2 * 3")
    
    Returns:
        Result of the calculation
    """
    try:
        # Safe eval with restricted globals
        allowed_names = {
            k: v for k, v in math.__dict__.items() if not k.startswith("__")
        }
        allowed_names.update({"abs": abs, "round": round})
        result = eval(expression, {"__builtins__": {}}, allowed_names)
        return float(result)
    except Exception as e:
        return f"Error: {str(e)}"

@mcp.tool()
def reverse_string(text: str) -> str:
    """
    Reverse a string.
    
    Args:
        text: Input string to reverse
    
    Returns:
        Reversed string
    """
    return text[::-1]

@mcp.tool()
def count_words(text: str) -> dict:
    """
    Count words, characters, and lines in text.
    
    Args:
        text: Input text to analyze
    
    Returns:
        Dictionary with word count, char count, line count
    """
    words = text.split()
    return {
        "words": len(words),
        "characters": len(text),
        "lines": len(text.splitlines()),
        "unique_words": len(set(w.lower() for w in words))
    }

@mcp.tool()
def list_files(path: str = ".") -> list:
    """
    List files in a directory.
    
    Args:
        path: Directory path (default: current directory)
    
    Returns:
        List of files with metadata
    """
    results = []
    try:
        for item in os.listdir(path):
            full_path = os.path.join(path, item)
            stats = os.stat(full_path)
            results.append({
                "name": item,
                "type": "directory" if stat.S_ISDIR(stats.st_mode) else "file",
                "size": stats.st_size,
                "modified": datetime.fromtimestamp(stats.st_mtime).isoformat()
            })
        return results
    except Exception as e:
        return [{"error": str(e)}]

@mcp.tool()
def get_system_info() -> dict:
    """
    Get system information from Codespace.
    
    Returns:
        Dictionary with system info
    """
    return {
        "hostname": os.uname().nodename,
        "platform": platform.platform(),
        "python_version": platform.python_version(),
        "codespace": os.getenv("CODESPACE_NAME", "Not in Codespace"),
        "cpu_count": os.cpu_count() or 1,
        "cwd": os.getcwd()
    }

# ============= MAIN =============

if __name__ == "__main__":
    # Check command line arguments
    if len(sys.argv) > 1 and sys.argv[1] == "--http":
        # Run in HTTP mode
        port = int(os.getenv("PORT", "8000"))
        logger.info(f"Starting Devil MCP HTTP server on port {port}")
        logger.info(f"Connect using: npx @modelcontextprotocol/inspector http://localhost:{port}")
        
        # Import here to avoid dependency issues
        import uvicorn
        from fastapi import FastAPI
        from starlette.routing import Route
        
        # Create a simple FastAPI app
        app = FastAPI()
        
        @app.get("/")
        async def root():
            return {"status": "Devil MCP server running", "port": port}
        
        @app.get("/sse")
        async def sse():
            from starlette.responses import Response
            return Response(
                content="event: endpoint\ndata: /messages\n\n",
                media_type="text/event-stream"
            )
        
        @app.post("/messages")
        async def messages():
            return {"ok": True}
        
        uvicorn.run(app, host="0.0.0.0", port=port)
    else:
        # Run in stdio mode (default)
        logger.info("Starting Devil MCP server in stdio mode")
        mcp.run()
