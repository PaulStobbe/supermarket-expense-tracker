# Contributing to Supermarket Expense Tracker

Thank you for your interest in contributing to the Supermarket Expense Tracker! This document provides guidelines and information for contributors.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git
- Google Cloud Console account (for OAuth testing)
- Code editor (VS Code recommended)

### Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/supermarket-expense-tracker.git
   cd supermarket-expense-tracker
   ```

3. **Set up the development environment**:
   ```bash
   npm run setup
   ```

4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. **Start development servers**:
   ```bash
   npm run dev
   ```

## Project Structure

```
supermarket-expense-tracker/
├── backend/                 # Express.js API
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── middleware/      # Custom middleware
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utility functions
│   └── database/           # Database files
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API calls
│   │   ├── hooks/         # Custom React hooks
│   │   ├── types/         # TypeScript definitions
│   │   └── utils/         # Utility functions
│   └── public/            # Static assets
├── docs/                   # Documentation
└── scripts/               # Build and utility scripts
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define proper types and interfaces
- Avoid `any` type unless absolutely necessary
- Use strict mode settings

### React

- Use functional components with hooks
- Follow React best practices
- Use proper prop typing
- Implement error boundaries where appropriate

### Node.js/Express

- Follow RESTful API conventions
- Use proper HTTP status codes
- Implement proper error handling
- Use middleware for common functionality

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

### File Naming Conventions

- **Components**: PascalCase (`ExpenseForm.tsx`)
- **Hooks**: camelCase starting with 'use' (`useExpenses.ts`)
- **Services**: PascalCase (`AuthService.ts`)
- **Utils**: camelCase (`formatCurrency.ts`)
- **Types**: PascalCase (`User.ts`)

### Code Organization

- Import order: external libraries, internal modules, relative imports
- Use barrel exports (`index.ts`) for cleaner imports
- Group related functionality together
- Keep functions small and focused

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
feat(expenses): add expense filtering by date range
fix(auth): resolve token expiration handling
docs(api): update authentication documentation
style(dashboard): improve responsive layout
refactor(services): extract common API logic
test(expenses): add expense creation tests
chore(deps): update dependencies
```

## Pull Request Process

### Before Submitting

1. **Update your branch** with the latest changes:
   ```bash
   git checkout main
   git pull upstream main
   git checkout your-feature-branch
   git rebase main
   ```

2. **Run tests and linting**:
   ```bash
   npm run test
   npm run lint
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

### PR Requirements

- [ ] Code follows the style guidelines
- [ ] Self-review of code has been performed
- [ ] Code is commented, particularly in hard-to-understand areas
- [ ] Changes generate no new warnings
- [ ] Tests have been added that prove the fix is effective or feature works
- [ ] New and existing unit tests pass locally
- [ ] Any dependent changes have been merged and published

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing

## Screenshots (if applicable)
Add screenshots to help explain your changes

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code
- [ ] I have made corresponding changes to documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective
- [ ] New and existing tests pass locally
```

## Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run backend tests only
npm run test:backend

# Run frontend tests only
npm run test:frontend

# Run tests in watch mode
npm run test:watch
```

### Writing Tests

#### Backend Tests

- Use Jest for unit testing
- Test controllers, services, and utilities
- Mock external dependencies
- Test error conditions

Example:
```typescript
describe('ExpenseService', () => {
  test('should create expense successfully', async () => {
    const expenseData = {
      store_name: 'Test Store',
      category: 'Groceries',
      amount: 50.00,
      purchase_date: '2023-01-01'
    };
    
    const result = await ExpenseService.createExpense(expenseData);
    expect(result.id).toBeDefined();
    expect(result.store_name).toBe('Test Store');
  });
});
```

#### Frontend Tests

- Use React Testing Library
- Test user interactions
- Test component rendering
- Mock API calls

Example:
```typescript
test('renders expense form', () => {
  render(<ExpenseForm />);
  expect(screen.getByLabelText(/store name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
});
```

### Test Coverage

- Aim for at least 80% test coverage
- Focus on critical business logic
- Test edge cases and error conditions

## Documentation

### Code Documentation

- Use JSDoc comments for functions and classes
- Document complex algorithms
- Explain business logic
- Include usage examples

### API Documentation

- Update API documentation for endpoint changes
- Include request/response examples
- Document error responses
- Update Postman collections if applicable

### README Updates

- Update feature lists
- Add new setup instructions
- Update screenshots if UI changes
- Keep troubleshooting section current

## Issue Guidelines

### Bug Reports

When reporting bugs, include:

1. **Description**: Clear description of the bug
2. **Steps to Reproduce**: Detailed steps
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**: OS, Node version, browser
6. **Screenshots**: If applicable

### Feature Requests

When requesting features, include:

1. **Problem**: What problem does this solve?
2. **Solution**: Proposed solution
3. **Alternatives**: Alternative solutions considered
4. **Examples**: Examples or mockups

## Development Tips

### Debugging

#### Backend Debugging

```bash
# Start with debugging enabled
npm run dev:debug

# View logs
npm run logs
```

#### Frontend Debugging

- Use React Developer Tools
- Check browser console
- Use network tab for API calls

### Performance

- Use React Profiler for performance issues
- Monitor bundle size
- Optimize database queries
- Use appropriate caching

### Security

- Never commit sensitive data
- Use environment variables
- Validate all inputs
- Follow OWASP guidelines

## Getting Help

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: General questions and discussions
- **Email**: paul@paulstobbe.com (security issues only)

### Resources

- [React Documentation](https://reactjs.org/docs)
- [Express.js Documentation](https://expressjs.com/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Jest Documentation](https://jestjs.io/docs)

## Recognition

Contributors will be recognized in:

- README.md contributors section
- Release notes for significant contributions
- Hall of fame for major contributors

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

Don't hesitate to ask questions! Create an issue or start a discussion if you need help getting started.

Thank you for contributing! 🎉