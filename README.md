# Transmission MCP Server

Model Context Protocol (MCP) server for the Transmission BitTorrent client. This server provides comprehensive tools to manage torrents, control the Transmission daemon, and monitor downloads through a standardized MCP interface.

## Features

- **Torrent Management**: Add, remove, pause, resume, and verify torrents
- **Queue Control**: Manage download queue order
- **Session Management**: Configure Transmission daemon settings
- **Real-time Monitoring**: Get torrent status, statistics, and progress
- **File Operations**: Move torrents, check free space
- **Flexible Output**: Support for both human-readable Markdown and machine-readable JSON formats

## Prerequisites

- Node.js 18 or higher
- Transmission daemon running locally or remotely
- Transmission RPC credentials (if authentication is enabled)

## Installation

```bash
npm install
npm run build
```

## Configuration

The server requires the Transmission daemon connection details via environment variables:

- `TRANSMISSION_URL` - Base URL of Transmission RPC (default: `http://localhost:9091`)
- `TRANSMISSION_USERNAME` - Username for authentication (optional)
- `TRANSMISSION_PASSWORD` - Password for authentication (optional)

Example:
```bash
export TRANSMISSION_URL="http://localhost:9091"
export TRANSMISSION_USERNAME="admin"
export TRANSMISSION_PASSWORD="password"
```

## Usage

### With Claude Desktop

Add to your Claude Desktop configuration:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "transmission": {
      "command": "node",
      "args": ["/path/to/transmission-mcp/dist/index.js"],
      "env": {
        "TRANSMISSION_URL": "http://localhost:9091",
        "TRANSMISSION_USERNAME": "your-username",
        "TRANSMISSION_PASSWORD": "your-password"
      }
    }
  }
}
```

### Standalone

```bash
npm start
```

## Available Tools

### Torrent Management

- `transmission_add_torrent` - Add torrent from magnet URI, URL, or base64-encoded .torrent file
- `transmission_list_torrents` - List all torrents with optional filtering
- `transmission_get_torrent` - Get detailed information about specific torrent(s)
- `transmission_remove_torrent` - Remove torrent with option to delete local files
- `transmission_pause_torrent` - Pause active torrent(s)
- `transmission_resume_torrent` - Resume paused torrent(s)
- `transmission_verify_torrent` - Verify torrent data integrity
- `transmission_reannounce_torrent` - Force tracker reannounce
- `transmission_move_torrent` - Move torrent to new location
- `transmission_set_torrent` - Update torrent settings (labels, priorities, limits)

### Queue Management

- `transmission_queue_move` - Move torrents in download queue (top/up/down/bottom)

### Session Management

- `transmission_get_session` - Get Transmission daemon configuration
- `transmission_set_session` - Update daemon settings
- `transmission_get_stats` - Get session statistics (current and cumulative)

### Utility

- `transmission_free_space` - Check available disk space

## Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Build the project
npm run build

# Clean build artifacts
npm run clean
```

## License

MIT
