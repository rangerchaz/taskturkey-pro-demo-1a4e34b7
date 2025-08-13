// src/backend/server.js
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://0.0.0.0:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from React build
app.use(express.static(path.join(__dirname, 'public')));

// In-memory data store (production would use a database)
let users = [];
let teams = [];
let projects = [];
let tasks = [];
let comments = [];
let sessions = [];

// Utility functions
const generateId = () => crypto.randomBytes(16).toString('hex');

const generateToken = (userId) => {
  const payload = {
    userId,
    timestamp: Date.now(),
    expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
};

const validateToken = (token) => {
  try {
    if (!token) return null;
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    if (payload.expires < Date.now()) return null;
    return payload;
  } catch (error) {
    return null;
  }
};

const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password + (process.env.SALT || 'taskturkey')).digest('hex');
};

// Authentication middleware
const authenticateUser = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const payload = validateToken(token);
    
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const user = users.find(u => u.id === payload.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token',
        code: 'INVALID_TOKEN'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication system error',
      code: 'AUTH_ERROR'
    });
  }
};

// Request validation middleware
const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const errors = [];
      
      for (const [field, rules] of Object.entries(schema)) {
        const value = req.body[field];
        
        if (rules.required && (value === undefined || value === null || value === '')) {
          errors.push(`${field} is required`);
          continue;
        }
        
        if (value !== undefined && value !== null) {
          if (rules.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(`${field} must be a valid email address`);
          }
          
          if (rules.minLength && value.length < rules.minLength) {
            errors.push(`${field} must be at least ${rules.minLength} characters long`);
          }
          
          if (rules.maxLength && value.length > rules.maxLength) {
            errors.push(`${field} cannot exceed ${rules.maxLength} characters`);
          }
          
          if (rules.pattern && !rules.pattern.test(value)) {
            errors.push(`${field} format is invalid`);
          }
        }
      }
      
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors,
          code: 'VALIDATION_ERROR'
        });
      }
      
      next();
    } catch (error) {
      console.error('Validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Validation system error',
        code: 'VALIDATION_SYSTEM_ERROR'
      });
    }
  };
};

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Error handling middleware
const handleError = (error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
};

// AUTHENTICATION ROUTES
app.post('/api/auth/register', 
  validateRequest({
    email: { required: true, type: 'email' },
    password: { required: true, minLength: 6 },
    name: { required: true, minLength: 2, maxLength: 50 }
  }),
  (req, res) => {
    try {
      const { email, password, name } = req.body;
      
      // Check if user exists
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        return res.status(409).json({
          success: false,
          error: 'User with this email already exists',
          code: 'USER_EXISTS'
        });
      }
      
      // Create new user
      const user = {
        id: generateId(),
        email: email.toLowerCase(),
        password: hashPassword(password),
        name: name.trim(),
        avatar: null,
        role: 'user',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      };
      
      users.push(user);
      
      // Generate token
      const token = generateToken(user.id);
      
      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            role: user.role
          },
          token
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR'
      });
    }
  }
);

app.post('/api/auth/login',
  validateRequest({
    email: { required: true, type: 'email' },
    password: { required: true }
  }),
  (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = users.find(u => 
        u.email.toLowerCase() === email.toLowerCase() && 
        u.password === hashPassword(password)
      );
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }
      
      // Update last active
      user.lastActive = new Date().toISOString();
      
      const token = generateToken(user.id);
      
      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            role: user.role
          },
          token
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed',
        code: 'LOGIN_ERROR'
      });
    }
  }
);

app.get('/api/auth/me', authenticateUser, (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        avatar: req.user.avatar,
        role: req.user.role
      }
    }
  });
});

// TEAM ROUTES
app.get('/api/teams', authenticateUser, (req, res) => {
  try {
    const userTeams = teams.filter(team => 
      team.members.some(member => member.userId === req.user.id)
    );
    
    res.json({
      success: true,
      data: userTeams
    });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch teams',
      code: 'FETCH_TEAMS_ERROR'
    });
  }
});

app.post('/api/teams',
  authenticateUser,
  validateRequest({
    name: { required: true, minLength: 2, maxLength: 100 },
    description: { maxLength: 500 }
  }),
  (req, res) => {
    try {
      const { name, description } = req.body;
      
      const team = {
        id: generateId(),
        name: name.trim(),
        description: description?.trim() || '',
        createdBy: req.user.id,
        members: [{
          userId: req.user.id,
          role: 'admin',
          joinedAt: new Date().toISOString()
        }],
        createdAt: new Date().toISOString()
      };
      
      teams.push(team);
      
      res.status(201).json({
        success: true,
        data: team
      });
    } catch (error) {
      console.error('Create team error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create team',
        code: 'CREATE_TEAM_ERROR'
      });
    }
  }
);

// PROJECT ROUTES
app.get('/api/projects', authenticateUser, (req, res) => {
  try {
    const { teamId } = req.query;
    let userProjects = projects;
    
    if (teamId) {
      userProjects = projects.filter(p => p.teamId === teamId);
    }
    
    // Filter projects where user has access
    userProjects = userProjects.filter(project => {
      const team = teams.find(t => t.id === project.teamId);
      return team && team.members.some(m => m.userId === req.user.id);
    });
    
    res.json({
      success: true,
      data: userProjects
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch projects',
      code: 'FETCH_PROJECTS_ERROR'
    });
  }
});

app.post('/api/projects',
  authenticateUser,
  validateRequest({
    name: { required: true, minLength: 2, maxLength: 100 },
    description: { maxLength: 1000 },
    teamId: { required: true }
  }),
  (req, res) => {
    try {
      const { name, description, teamId } = req.body;
      
      // Verify user is member of the team
      const team = teams.find(t => t.id === teamId);
      if (!team || !team.members.some(m => m.userId === req.user.id)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this team',
          code: 'ACCESS_DENIED'
        });
      }
      
      const project = {
        id: generateId(),
        name: name.trim(),
        description: description?.trim() || '',
        teamId,
        createdBy: req.user.id,
        status: 'active',
        createdAt: new Date().toISOString()
      };
      
      projects.push(project);
      
      res.status(201).json({
        success: true,
        data: project
      });
    } catch (error) {
      console.error('Create project error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create project',
        code: 'CREATE_PROJECT_ERROR'
      });
    }
  }
);

// TASK ROUTES
app.get('/api/tasks', authenticateUser, (req, res) => {
  try {
    const { projectId, assignedTo, status } = req.query;
    let userTasks = tasks;
    
    // Filter by project
    if (projectId) {
      userTasks = userTasks.filter(t => t.projectId === projectId);
    }
    
    // Filter by assignee
    if (assignedTo) {
      userTasks = userTasks.filter(t => t.assignedTo === assignedTo);
    }
    
    // Filter by status
    if (status) {
      userTasks = userTasks.filter(t => t.status === status);
    }
    
    // Only return tasks from projects user has access to
    userTasks = userTasks.filter(task => {
      const project = projects.find(p => p.id === task.projectId);
      if (!project) return false;
      
      const team = teams.find(t => t.id === project.teamId);
      return team && team.members.some(m => m.userId === req.user.id);
    });
    
    res.json({
      success: true,
      data: userTasks
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tasks',
      code: 'FETCH_TASKS_ERROR'
    });
  }
});

app.post('/api/tasks',
  authenticateUser,
  validateRequest({
    title: { required: true, minLength: 2, maxLength: 200 },
    description: { maxLength: 2000 },
    projectId: { required: true },
    priority: { required: true }
  }),
  (req, res) => {
    try {
      const { title, description, projectId, assignedTo, priority, dueDate } = req.body;
      
      // Verify project access
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        });
      }
      
      const team = teams.find(t => t.id === project.teamId);
      if (!team || !team.members.some(m => m.userId === req.user.id)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this project',
          code: 'ACCESS_DENIED'
        });
      }
      
      // Validate priority
      if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid priority value',
          code: 'INVALID_PRIORITY'
        });
      }
      
      const task = {
        id: generateId(),
        title: title.trim(),
        description: description?.trim() || '',
        projectId,
        assignedTo: assignedTo || null,
        createdBy: req.user.id,
        status: 'todo',
        priority,
        dueDate: dueDate || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      tasks.push(task);
      
      res.status(201).json({
        success: true,
        data: task
      });
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create task',
        code: 'CREATE_TASK_ERROR'
      });
    }
  }
);

app.put('/api/tasks/:taskId',
  authenticateUser,
  (req, res) => {
    try {
      const { taskId } = req.params;
      const updates = req.body;
      
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
          code: 'TASK_NOT_FOUND'
        });
      }
      
      const task = tasks[taskIndex];
      
      // Verify access
      const project = projects.find(p => p.id === task.projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Associated project not found',
          code: 'PROJECT_NOT_FOUND'
        });
      }
      
      const team = teams.find(t => t.id === project.teamId);
      if (!team || !team.members.some(m => m.userId === req.user.id)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this task',
          code: 'ACCESS_DENIED'
        });
      }
      
      // Update allowed fields
      const allowedUpdates = ['title', 'description', 'assignedTo', 'status', 'priority', 'dueDate'];
      const updatedTask = { ...task };
      
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          updatedTask[field] = updates[field];
        }
      });
      
      // Validate status
      if (updatedTask.status && !['todo', 'in-progress', 'done'].includes(updatedTask.status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status value',
          code: 'INVALID_STATUS'
        });
      }
      
      // Validate priority
      if (updatedTask.priority && !['low', 'medium', 'high', 'urgent'].includes(updatedTask.priority)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid priority value',
          code: 'INVALID_PRIORITY'
        });
      }
      
      updatedTask.updatedAt = new Date().toISOString();
      tasks[taskIndex] = updatedTask;
      
      res.json({
        success: true,
        data: updatedTask
      });
    } catch (error) {
      console.error('Update task error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update task',
        code: 'UPDATE_TASK_ERROR'
      });
    }
  }
);

app.delete('/api/tasks/:taskId', authenticateUser, (req, res) => {
  try {
    const { taskId } = req.params;
    
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }
    
    const task = tasks[taskIndex];
    
    // Verify access (only creator or team admin can delete)
    const project = projects.find(p => p.id === task.projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Associated project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }
    
    const team = teams.find(t => t.id === project.teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Associated team not found',
        code: 'TEAM_NOT_FOUND'
      });
    }
    
    const userMembership = team.members.find(m => m.userId === req.user.id);
    if (!userMembership || (task.createdBy !== req.user.id && userMembership.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - insufficient permissions',
        code: 'ACCESS_DENIED'
      });
    }
    
    // Remove task
    tasks.splice(taskIndex, 1);
    
    // Remove associated comments
    comments = comments.filter(c => c.taskId !== taskId);
    
    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete task',
      code: 'DELETE_TASK_ERROR'
    });
  }
});

// ANALYTICS ROUTES
app.get('/api/analytics/dashboard', authenticateUser, (req, res) => {
  try {
    const { teamId, projectId } = req.query;
    
    // Get user's accessible teams
    const userTeams = teams.filter(team => 
      team.members.some(member => member.userId === req.user.id)
    );
    
    let filteredTasks = tasks.filter(task => {
      const project = projects.find(p => p.id === task.projectId);
      if (!project) return false;
      
      return userTeams.some(team => team.id === project.teamId);
    });
    
    // Apply filters
    if (teamId) {
      filteredTasks = filteredTasks.filter(task => {
        const project = projects.find(p => p.id === task.projectId);
        return project && project.teamId === teamId;
      });
    }
    
    if (projectId) {
      filteredTasks = filteredTasks.filter(task => task.projectId === projectId);
    }
    
    // Calculate analytics
    const totalTasks = filteredTasks.length;
    const completedTasks = filteredTasks.filter(t => t.status === 'done').length;
    const inProgressTasks = filteredTasks.filter(t => t.status === 'in-progress').length;
    const todoTasks = filteredTasks.filter(t => t.status === 'todo').length;
    
    const tasksByPriority = {
      urgent: filteredTasks.filter(t => t.priority === 'urgent').length,
      high: filteredTasks.filter(t => t.priority === 'high').length,
      medium: filteredTasks.filter(t => t.priority === 'medium').length,
      low: filteredTasks.filter(t => t.priority === 'low').length
    };
    
    const overdueTasks = filteredTasks.filter(task => {
      if (!task.dueDate) return false;
      return new Date(task.dueDate) < new Date() && task.status !== 'done';
    }).length;
    
    res.json({
      success: true,
      data: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        todoTasks,
        tasksByPriority,
        overdueTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
      code: 'ANALYTICS_ERROR'
    });
  }
});

// HEALTH CHECK ROUTE
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    data: {
      users: users.length,
      teams: teams.length,
      projects: projects.length,
      tasks: tasks.length
    }
  });
});

// Serve React app for all non-API routes (client-side routing)
// This must come after all API routes
app.get('*', (req, res) => {
  // Only serve index.html if the request is not for an API route
  if (!req.path.startsWith('/api')) {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      // Fallback if no React build is present
      res.status(404).send('React app not found. Please ensure the frontend is built.');
    }
  } else {
    res.status(404).json({ 
      success: false, 
      error: 'API endpoint not found',
      code: 'NOT_FOUND'
    });
  }
});

// Global error handler
app.use(handleError);

// Initialize with sample data for development
const initializeSampleData = () => {
  try {
    // Create sample user
    const sampleUser = {
      id: generateId(),
      email: 'admin@taskturkey.com',
      password: hashPassword('password123'),
      name: 'Admin User',
      avatar: null,
      role: 'admin',
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };
    users.push(sampleUser);
    
    // Create sample team
    const sampleTeam = {
      id: generateId(),
      name: 'Development Team',
      description: 'Main development team for TaskTurkey Pro',
      createdBy: sampleUser.id,
      members: [{
        userId: sampleUser.id,
        role: 'admin',
        joinedAt: new Date().toISOString()
      }],
      createdAt: new Date().toISOString()
    };
    teams.push(sampleTeam);
    
    // Create sample project
    const sampleProject = {
      id: generateId(),
      name: 'TaskTurkey Pro MVP',
      description: 'Development of the MVP version',
      teamId: sampleTeam.id,
      createdBy: sampleUser.id,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    projects.push(sampleProject);
    
    console.log('Sample data initialized successfully');
  } catch (error) {
    console.error('Failed to initialize sample data:', error);
  }
};

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TaskTurkey Pro Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://0.0.0.0:3000'}`);
  
  // Initialize sample data
  initializeSampleData();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
