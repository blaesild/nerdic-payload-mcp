# Nerdic Payload MCP

A tool for generating and managing payload-specific structures.

## Features

- Generate payload structures based on templates
- Query existing payload configurations
- Scaffold new payload projects
- Validate payload structures

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/nerdic-payload-mcp.git
cd nerdic-payload-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example` and fill in your configuration:
```bash
cp .env.example .env
```

## Development

To start the development server:

```bash
npm run dev
```

The server will start on http://localhost:3000 by default.

## Building for Production

To build the project:

```bash
npm run build
```

To start the production server:

```bash
npm start
```

## API Endpoints

### MCP Routes

- `POST /api/mcp/generate` - Generate payload structures
- `GET /api/mcp/query` - Query existing configurations
- `POST /api/mcp/scaffold` - Scaffold new projects
- `POST /api/mcp/validate` - Validate payload structures

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `OPENAI_API_KEY` - OpenAI API key for AI features
- `CORS_ORIGIN` - Allowed CORS origin

## Project Structure

```
NERDIC PAYLOAD MCP/
├── src/
│   ├── api/             # API route definitions
│   │   ├── mcp/        # MCP-specific routes
│   │   └── middleware/ # Express middleware
│   ├── core/           # Core MCP logic
│   └── server.ts       # Express app initialization
├── .env                # Environment variables
├── package.json        # Dependencies and scripts
├── tsconfig.json      # TypeScript configuration
└── vercel.json        # Vercel deployment config
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 