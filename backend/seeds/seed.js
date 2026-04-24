require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const pool = require('../db');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('Seeding AI Code Interpreter...');

  await pool.query(`
    DROP TABLE IF EXISTS conversation_messages, conversations, execution_logs, collaborators,
      secrets, execution_history, code_templates, code_reviews, datasets, visualizations,
      packages, environments, notebooks, executions, code_snippets, settings, users CASCADE;
  `);

  await pool.query(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) DEFAULT 'Admin',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE code_snippets (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      language VARCHAR(50) DEFAULT 'python',
      code TEXT,
      description TEXT,
      tags TEXT,
      is_public BOOLEAN DEFAULT false,
      run_count INTEGER DEFAULT 0,
      status VARCHAR(50) DEFAULT 'active',
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE executions (
      id SERIAL PRIMARY KEY,
      snippet_id INTEGER,
      language VARCHAR(50) DEFAULT 'python',
      code TEXT,
      status VARCHAR(50) DEFAULT 'completed',
      exit_code INTEGER DEFAULT 0,
      stdout TEXT,
      stderr TEXT,
      execution_time_ms INTEGER DEFAULT 0,
      memory_used_mb NUMERIC(10,2) DEFAULT 0,
      output JSONB DEFAULT '{}',
      environment JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE notebooks (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      description TEXT,
      language VARCHAR(50) DEFAULT 'python',
      cell_count INTEGER DEFAULT 0,
      cells JSONB DEFAULT '[]',
      status VARCHAR(50) DEFAULT 'active',
      tags TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE environments (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      runtime VARCHAR(100),
      version VARCHAR(50),
      description TEXT,
      status VARCHAR(50) DEFAULT 'active',
      packages JSONB DEFAULT '[]',
      env_vars JSONB DEFAULT '{}',
      memory_limit VARCHAR(50) DEFAULT '512MB',
      timeout_seconds INTEGER DEFAULT 30,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE packages (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      version VARCHAR(50),
      language VARCHAR(50) DEFAULT 'python',
      description TEXT,
      install_command VARCHAR(500),
      homepage VARCHAR(500),
      license VARCHAR(100),
      downloads INTEGER DEFAULT 0,
      status VARCHAR(50) DEFAULT 'installed',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE visualizations (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      viz_type VARCHAR(50),
      description TEXT,
      code TEXT,
      config JSONB DEFAULT '{}',
      data_source JSONB DEFAULT '{}',
      library VARCHAR(100) DEFAULT 'matplotlib',
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE datasets (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      format VARCHAR(50) DEFAULT 'csv',
      size VARCHAR(50),
      row_count INTEGER DEFAULT 0,
      column_count INTEGER DEFAULT 0,
      schema_def JSONB DEFAULT '[]',
      sample_data JSONB DEFAULT '[]',
      source VARCHAR(500),
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE code_reviews (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      language VARCHAR(50),
      code TEXT,
      review_type VARCHAR(50) DEFAULT 'full',
      score INTEGER DEFAULT 0,
      grade VARCHAR(10),
      summary TEXT,
      issues JSONB DEFAULT '[]',
      suggestions JSONB DEFAULT '[]',
      status VARCHAR(50) DEFAULT 'completed',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE code_templates (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      language VARCHAR(50) DEFAULT 'python',
      category VARCHAR(100),
      description TEXT,
      code TEXT,
      variables JSONB DEFAULT '[]',
      usage_count INTEGER DEFAULT 0,
      is_public BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE execution_history (
      id SERIAL PRIMARY KEY,
      snippet_id INTEGER,
      language VARCHAR(50),
      code_preview VARCHAR(500),
      status VARCHAR(50) DEFAULT 'completed',
      execution_time_ms INTEGER DEFAULT 0,
      exit_code INTEGER DEFAULT 0,
      triggered_by VARCHAR(100) DEFAULT 'manual',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE secrets (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      secret_type VARCHAR(50) DEFAULT 'api_key',
      masked_value VARCHAR(100),
      environment VARCHAR(100) DEFAULT 'all',
      last_used TIMESTAMP,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE collaborators (
      id SERIAL PRIMARY KEY,
      notebook_id INTEGER,
      user_email VARCHAR(255),
      role VARCHAR(50) DEFAULT 'viewer',
      permissions VARCHAR(200) DEFAULT 'view',
      status VARCHAR(50) DEFAULT 'active',
      invited_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE execution_logs (
      id SERIAL PRIMARY KEY,
      execution_id INTEGER,
      level VARCHAR(20) DEFAULT 'info',
      message TEXT,
      source VARCHAR(100),
      line_number INTEGER,
      timestamp_ms BIGINT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE settings (
      id SERIAL PRIMARY KEY,
      key VARCHAR(255) UNIQUE NOT NULL,
      value TEXT,
      category VARCHAR(100) DEFAULT 'general',
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE conversations (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500),
      model VARCHAR(200),
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE conversation_messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER REFERENCES conversations(id),
      role VARCHAR(50),
      content TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Seed user
  const hash = await bcrypt.hash(process.env.DEFAULT_PASSWORD || 'admin123', 10);
  await pool.query('INSERT INTO users (email, password, name) VALUES ($1, $2, $3)',
    [process.env.DEFAULT_EMAIL || 'admin@codeinterpreter.ai', hash, 'Admin User']);

  // Seed code snippets
  const snippets = [
    ['Fibonacci Generator', 'python', 'def fibonacci(n):\n    a, b = 0, 1\n    result = []\n    for _ in range(n):\n        result.append(a)\n        a, b = b, a + b\n    return result\n\nprint(fibonacci(20))', 'Generate Fibonacci sequence up to n numbers', 'algorithm,math,sequence', false, 45, 'active', '{"complexity":"O(n)","category":"algorithms"}'],
    ['Quick Sort Implementation', 'python', 'def quicksort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    middle = [x for x in arr if x == pivot]\n    right = [x for x in arr if x > pivot]\n    return quicksort(left) + middle + quicksort(right)\n\nprint(quicksort([3,6,8,10,1,2,1]))', 'Classic quicksort algorithm in Python', 'sorting,algorithm,divide-and-conquer', true, 78, 'active', '{"complexity":"O(n log n)","category":"sorting"}'],
    ['REST API with Express', 'javascript', 'const express = require("express");\nconst app = express();\napp.use(express.json());\n\nlet items = [{id: 1, name: "Item 1"}];\n\napp.get("/api/items", (req, res) => res.json(items));\napp.post("/api/items", (req, res) => {\n  const item = {id: items.length + 1, ...req.body};\n  items.push(item);\n  res.status(201).json(item);\n});\n\napp.listen(3000);', 'Simple REST API using Express.js', 'api,rest,express,web', true, 112, 'active', '{"framework":"express","category":"web"}'],
    ['Binary Search Tree', 'python', 'class Node:\n    def __init__(self, val):\n        self.val = val\n        self.left = self.right = None\n\nclass BST:\n    def __init__(self):\n        self.root = None\n\n    def insert(self, val):\n        self.root = self._insert(self.root, val)\n\n    def _insert(self, node, val):\n        if not node:\n            return Node(val)\n        if val < node.val:\n            node.left = self._insert(node.left, val)\n        else:\n            node.right = self._insert(node.right, val)\n        return node', 'Binary search tree implementation with insert', 'data-structure,tree,bst', false, 34, 'active', '{"complexity":"O(log n)","category":"data-structures"}'],
    ['JWT Authentication', 'javascript', 'const jwt = require("jsonwebtoken");\nconst SECRET = "my-secret";\n\nfunction generateToken(user) {\n  return jwt.sign({id: user.id, email: user.email}, SECRET, {expiresIn: "24h"});\n}\n\nfunction verifyToken(token) {\n  try {\n    return jwt.verify(token, SECRET);\n  } catch(e) {\n    return null;\n  }\n}', 'JWT token generation and verification', 'auth,jwt,security', true, 67, 'active', '{"category":"security"}'],
    ['DataFrame Analysis', 'python', 'import pandas as pd\nimport numpy as np\n\ndf = pd.DataFrame({\n    "name": ["Alice", "Bob", "Charlie", "Diana"],\n    "age": [25, 30, 35, 28],\n    "salary": [50000, 60000, 75000, 55000]\n})\n\nprint(df.describe())\nprint(f"Mean salary: ${df.salary.mean():,.2f}")\nprint(f"Oldest: {df.loc[df.age.idxmax(), \'name\']}")', 'Pandas DataFrame basic analysis', 'pandas,data-analysis,dataframe', true, 89, 'active', '{"library":"pandas","category":"data-science"}'],
    ['Web Scraper', 'python', 'import requests\nfrom bs4 import BeautifulSoup\n\ndef scrape_page(url):\n    response = requests.get(url)\n    soup = BeautifulSoup(response.text, "html.parser")\n    titles = soup.find_all("h2")\n    return [t.text.strip() for t in titles]\n\nresults = scrape_page("https://example.com")\nfor r in results:\n    print(r)', 'Simple web scraper using BeautifulSoup', 'scraping,beautifulsoup,web', false, 56, 'active', '{"library":"beautifulsoup4","category":"web-scraping"}'],
    ['Async/Await Pattern', 'javascript', 'async function fetchData(urls) {\n  const results = await Promise.all(\n    urls.map(url => \n      fetch(url).then(r => r.json()).catch(e => ({error: e.message}))\n    )\n  );\n  return results;\n}\n\nconst urls = [\n  "https://api.example.com/users",\n  "https://api.example.com/posts"\n];\nfetchData(urls).then(console.log);', 'Parallel async data fetching with error handling', 'async,promise,fetch,parallel', true, 91, 'active', '{"category":"async-patterns"}'],
    ['Database Connection Pool', 'python', 'import psycopg2\nfrom psycopg2 import pool\n\nconnection_pool = pool.ThreadedConnectionPool(\n    minconn=2,\n    maxconn=10,\n    host="localhost",\n    database="mydb",\n    user="postgres",\n    password="secret"\n)\n\ndef query(sql, params=None):\n    conn = connection_pool.getconn()\n    try:\n        with conn.cursor() as cur:\n            cur.execute(sql, params)\n            return cur.fetchall()\n    finally:\n        connection_pool.putconn(conn)', 'PostgreSQL connection pool with psycopg2', 'database,postgres,pool,connection', false, 42, 'active', '{"library":"psycopg2","category":"database"}'],
    ['React Custom Hook', 'typescript', 'import { useState, useEffect } from "react";\n\ninterface FetchState<T> {\n  data: T | null;\n  loading: boolean;\n  error: string | null;\n}\n\nfunction useFetch<T>(url: string): FetchState<T> {\n  const [state, setState] = useState<FetchState<T>>({\n    data: null, loading: true, error: null\n  });\n\n  useEffect(() => {\n    fetch(url)\n      .then(r => r.json())\n      .then(data => setState({data, loading: false, error: null}))\n      .catch(e => setState({data: null, loading: false, error: e.message}));\n  }, [url]);\n\n  return state;\n}', 'Generic TypeScript fetch hook for React', 'react,hook,typescript,fetch', true, 103, 'active', '{"framework":"react","category":"frontend"}'],
    ['Merge Sort', 'go', 'package main\n\nimport "fmt"\n\nfunc mergeSort(arr []int) []int {\n\tif len(arr) <= 1 {\n\t\treturn arr\n\t}\n\tmid := len(arr) / 2\n\tleft := mergeSort(arr[:mid])\n\tright := mergeSort(arr[mid:])\n\treturn merge(left, right)\n}\n\nfunc merge(left, right []int) []int {\n\tresult := make([]int, 0, len(left)+len(right))\n\ti, j := 0, 0\n\tfor i < len(left) && j < len(right) {\n\t\tif left[i] <= right[j] {\n\t\t\tresult = append(result, left[i])\n\t\t\ti++\n\t\t} else {\n\t\t\tresult = append(result, right[j])\n\t\t\tj++\n\t\t}\n\t}\n\tresult = append(result, left[i:]...)\n\tresult = append(result, right[j:]...)\n\treturn result\n}', 'Merge sort implementation in Go', 'sorting,algorithm,go', true, 28, 'active', '{"complexity":"O(n log n)","category":"sorting"}'],
    ['Docker Compose Generator', 'python', 'import yaml\n\ndef generate_compose(services):\n    compose = {"version": "3.8", "services": {}}\n    for svc in services:\n        compose["services"][svc["name"]] = {\n            "image": svc["image"],\n            "ports": svc.get("ports", []),\n            "environment": svc.get("env", {}),\n            "volumes": svc.get("volumes", [])\n        }\n    return yaml.dump(compose, default_flow_style=False)\n\nresult = generate_compose([\n    {"name": "web", "image": "nginx:latest", "ports": ["80:80"]},\n    {"name": "db", "image": "postgres:15", "env": {"POSTGRES_PASSWORD": "secret"}}\n])\nprint(result)', 'Generate Docker Compose files programmatically', 'docker,yaml,devops,compose', false, 37, 'active', '{"category":"devops"}'],
    ['LRU Cache', 'python', 'from collections import OrderedDict\n\nclass LRUCache:\n    def __init__(self, capacity: int):\n        self.cache = OrderedDict()\n        self.capacity = capacity\n\n    def get(self, key: int) -> int:\n        if key not in self.cache:\n            return -1\n        self.cache.move_to_end(key)\n        return self.cache[key]\n\n    def put(self, key: int, value: int):\n        if key in self.cache:\n            self.cache.move_to_end(key)\n        self.cache[key] = value\n        if len(self.cache) > self.capacity:\n            self.cache.popitem(last=False)', 'LRU Cache implementation using OrderedDict', 'cache,lru,data-structure', true, 61, 'active', '{"complexity":"O(1)","category":"data-structures"}'],
    ['GraphQL Schema', 'javascript', 'const { ApolloServer, gql } = require("apollo-server");\n\nconst typeDefs = gql`\n  type User {\n    id: ID!\n    name: String!\n    email: String!\n    posts: [Post!]\n  }\n  type Post {\n    id: ID!\n    title: String!\n    author: User!\n  }\n  type Query {\n    users: [User!]\n    user(id: ID!): User\n  }\n`;\n\nconst resolvers = {\n  Query: {\n    users: () => users,\n    user: (_, {id}) => users.find(u => u.id === id)\n  }\n};', 'GraphQL server with Apollo', 'graphql,apollo,api,schema', true, 54, 'active', '{"framework":"apollo","category":"api"}'],
    ['Regex Pattern Matcher', 'python', 'import re\n\npatterns = {\n    "email": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",\n    "phone": r"\\+?1?[-.\\s]?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}",\n    "url": r"https?://(?:www\\.)?[\\w.-]+\\.\\w{2,}(?:/\\S*)?",\n    "ipv4": r"\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b",\n    "date": r"\\d{4}[-/]\\d{2}[-/]\\d{2}"\n}\n\ndef validate(text, pattern_name):\n    pattern = patterns.get(pattern_name)\n    if not pattern:\n        return False\n    return bool(re.match(pattern, text))\n\nprint(validate("user@example.com", "email"))  # True\nprint(validate("not-an-email", "email"))  # False', 'Common regex patterns for validation', 'regex,validation,patterns', true, 73, 'active', '{"category":"utilities"}'],
  ];
  for (const s of snippets) {
    await pool.query('INSERT INTO code_snippets (title,language,code,description,tags,is_public,run_count,status,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', s);
  }

  // Seed executions
  const executions = [
    [1, 'python', 'print(fibonacci(20))', 'completed', 0, '[0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181]', '', 12, 2.4, '{"return_value":"list"}', '{"python":"3.11","os":"linux"}'],
    [2, 'python', 'quicksort([3,6,8,10,1,2,1])', 'completed', 0, '[1, 1, 2, 3, 6, 8, 10]', '', 8, 1.8, '{"return_value":"list"}', '{"python":"3.11"}'],
    [3, 'javascript', 'node server.js', 'completed', 0, 'Server listening on port 3000', '', 145, 28.5, '{}', '{"node":"20.10","os":"linux"}'],
    [6, 'python', 'df.describe()', 'completed', 0, '         age    salary\ncount   4.0    4.00\nmean   29.5  60000.00\nstd     4.2  10801.23\nmin    25.0  50000.00\nmax    35.0  75000.00', '', 45, 12.1, '{"rows":4,"columns":3}', '{"python":"3.11","pandas":"2.1"}'],
    [7, 'python', 'scrape_page("https://example.com")', 'completed', 0, '["Example Domain"]', '', 892, 5.6, '{"pages_scraped":1}', '{"python":"3.11","requests":"2.31"}'],
    [10, 'typescript', 'useFetch<User[]>("/api/users")', 'completed', 0, '{"data":[{"id":1,"name":"Alice"}],"loading":false,"error":null}', '', 23, 3.2, '{}', '{"node":"20.10","typescript":"5.3"}'],
    [4, 'python', 'bst.insert(5); bst.insert(3); bst.insert(7)', 'completed', 0, 'Tree: 3 <- 5 -> 7', '', 5, 0.8, '{"tree_depth":2}', '{"python":"3.11"}'],
    [5, 'javascript', 'generateToken({id:1,email:"test@test.com"})', 'completed', 0, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', '', 3, 1.1, '{"token_length":156}', '{"node":"20.10"}'],
    [8, 'javascript', 'fetchData(urls)', 'completed', 0, '[{"users":[...]},{"posts":[...]}]', '', 234, 8.4, '{"urls_fetched":2}', '{"node":"20.10"}'],
    [9, 'python', 'connection_pool.getconn()', 'failed', 1, '', 'psycopg2.OperationalError: could not connect to server', 5012, 0.5, '{}', '{"python":"3.11"}'],
    [11, 'go', 'mergeSort([]int{38,27,43,3,9,82,10})', 'completed', 0, '[3 9 10 27 38 43 82]', '', 6, 1.2, '{}', '{"go":"1.21"}'],
    [12, 'python', 'generate_compose(services)', 'completed', 0, 'version: "3.8"\nservices:\n  web:\n    image: nginx:latest\n    ports:\n    - 80:80', '', 15, 3.8, '{}', '{"python":"3.11","pyyaml":"6.0"}'],
    [13, 'python', 'cache = LRUCache(3); cache.put(1,"a")', 'completed', 0, 'Cache state: {1: "a"}', '', 2, 0.3, '{"cache_size":1}', '{"python":"3.11"}'],
    [14, 'javascript', 'new ApolloServer({typeDefs, resolvers}).listen()', 'completed', 0, 'GraphQL server ready at http://localhost:4000/', '', 340, 15.2, '{}', '{"node":"20.10","apollo":"4.9"}'],
    [15, 'python', 'validate("user@example.com", "email")', 'completed', 0, 'True', '', 1, 0.2, '{}', '{"python":"3.11"}'],
  ];
  for (const e of executions) {
    await pool.query('INSERT INTO executions (snippet_id,language,code,status,exit_code,stdout,stderr,execution_time_ms,memory_used_mb,output,environment) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', e);
  }

  // Seed notebooks
  const nb = (cells) => JSON.stringify(cells);
  const notebooks = [
    ['Data Analysis Tutorial', 'Step-by-step data analysis with pandas', 'python', 8, nb([{type:"markdown",content:"# Data Analysis"},{type:"code",content:"import pandas as pd"},{type:"code",content:"df = pd.read_csv('data.csv')"},{type:"markdown",content:"## Summary Statistics"},{type:"code",content:"df.describe()"}]), 'active', 'tutorial,pandas,analysis'],
    ['Machine Learning Basics', 'Introduction to ML with scikit-learn', 'python', 12, nb([{type:"markdown",content:"# ML Basics"},{type:"code",content:"from sklearn.model_selection import train_test_split"},{type:"code",content:"X_train, X_test = train_test_split(X, test_size=0.2)"}]), 'active', 'ml,sklearn,tutorial'],
    ['API Testing Suite', 'Automated API endpoint testing', 'python', 6, nb([{type:"code",content:"import requests"},{type:"code",content:"resp = requests.get(base_url + '/api/health')"},{type:"code",content:"assert resp.status_code == 200"}]), 'active', 'testing,api,requests'],
    ['SQL Query Builder', 'Dynamic SQL query construction', 'python', 5, nb([{type:"markdown",content:"# SQL Builder"},{type:"code",content:"def build_select(table, columns):\n    return f'SELECT {columns} FROM {table}'"}]), 'active', 'sql,database,query'],
    ['Web Scraping Pipeline', 'Multi-page scraping with rate limiting', 'python', 10, nb([{type:"code",content:"import requests\nimport time\nfrom bs4 import BeautifulSoup"},{type:"code",content:"def scrape(urls):\n    return [requests.get(u).text for u in urls]"}]), 'active', 'scraping,pipeline,beautifulsoup'],
    ['TypeScript Patterns', 'Common TypeScript design patterns', 'typescript', 7, nb([{type:"markdown",content:"# TS Patterns"},{type:"code",content:"interface Repository<T> {\n  findById(id: string): Promise<T>;\n  save(entity: T): Promise<T>;\n}"}]), 'active', 'typescript,patterns,design'],
    ['Docker Automation', 'Container management scripts', 'python', 4, nb([{type:"code",content:"import subprocess"},{type:"code",content:"def list_containers():\n    result = subprocess.run(['docker','ps'], capture_output=True, text=True)\n    return result.stdout"}]), 'draft', 'docker,devops,automation'],
    ['Data Visualization Gallery', 'Various chart types with matplotlib', 'python', 15, nb([{type:"markdown",content:"# Visualization Gallery"},{type:"code",content:"import matplotlib.pyplot as plt\nimport numpy as np"},{type:"code",content:"fig, axes = plt.subplots(2, 2, figsize=(12, 10))"}]), 'active', 'visualization,matplotlib,charts'],
    ['Cryptography Examples', 'Common encryption and hashing patterns', 'python', 6, nb([{type:"code",content:"from cryptography.fernet import Fernet"},{type:"code",content:"key = Fernet.generate_key()\nf = Fernet(key)\nencrypted = f.encrypt(b'secret')"}]), 'active', 'crypto,security,encryption'],
    ['Performance Benchmarks', 'Benchmarking different algorithm implementations', 'python', 8, nb([{type:"code",content:"import timeit"},{type:"code",content:"def benchmark(func, n=1000):\n    return timeit.timeit(func, number=n)"}]), 'active', 'benchmark,performance,timing'],
    ['React Component Library', 'Reusable React components', 'typescript', 10, nb([{type:"code",content:"import React from 'react'"},{type:"code",content:"const Button = ({variant, children}) => (\n  <button className={'btn-' + variant}>{children}</button>\n)"}]), 'active', 'react,components,ui'],
    ['Kubernetes Deployment', 'K8s manifest generation', 'python', 5, nb([{type:"code",content:"import yaml"},{type:"code",content:"def gen_deploy(name, image, replicas=3):\n    return yaml.dump({'apiVersion':'apps/v1','kind':'Deployment','metadata':{'name':name}})"}]), 'draft', 'kubernetes,k8s,devops'],
    ['GraphQL Client', 'GraphQL query builder and executor', 'javascript', 6, nb([{type:"code",content:"const { ApolloClient } = require('@apollo/client')"},{type:"code",content:"const GET_USERS = 'query { users { id name email } }'"}]), 'active', 'graphql,apollo,client'],
    ['ETL Pipeline', 'Extract-Transform-Load data pipeline', 'python', 9, nb([{type:"markdown",content:"# ETL Pipeline"},{type:"code",content:"def extract(source):\n    return pd.read_csv(source)"},{type:"code",content:"def transform(df):\n    return df.dropna()"},{type:"code",content:"def load(df, target):\n    df.to_sql(target, engine)"}]), 'active', 'etl,pipeline,data-engineering'],
    ['WebSocket Chat Server', 'Real-time chat with WebSocket', 'javascript', 7, nb([{type:"code",content:"const WebSocket = require('ws')"},{type:"code",content:"const wss = new WebSocket.Server({ port: 8080 })"},{type:"code",content:"wss.on('connection', ws => {\n  ws.on('message', msg => {\n    wss.clients.forEach(c => c.send(msg))\n  })\n})"}]), 'active', 'websocket,chat,realtime'],
  ];
  for (const n of notebooks) {
    await pool.query('INSERT INTO notebooks (title,description,language,cell_count,cells,status,tags) VALUES ($1,$2,$3,$4,$5,$6,$7)', n);
  }

  // Seed environments
  const environments = [
    ['Python 3.11', 'python', '3.11.7', 'Standard Python environment with data science libs', 'active', '["numpy","pandas","matplotlib","scikit-learn","requests"]', '{"PYTHONPATH":"/usr/lib/python3.11"}', '1GB', 60],
    ['Node.js 20', 'nodejs', '20.10.0', 'LTS Node.js with common packages', 'active', '["express","axios","lodash","jest","typescript"]', '{"NODE_ENV":"development"}', '512MB', 30],
    ['Go 1.21', 'go', '1.21.5', 'Go environment with standard library', 'active', '["gin","gorm","cobra","viper"]', '{"GOPATH":"/go"}', '256MB', 30],
    ['Rust 1.74', 'rust', '1.74.0', 'Rust with cargo and common crates', 'active', '["serde","tokio","reqwest","clap"]', '{"CARGO_HOME":"/cargo"}', '512MB', 60],
    ['TypeScript 5.3', 'typescript', '5.3.3', 'TypeScript with Node.js runtime', 'active', '["ts-node","@types/node","zod","prisma"]', '{"TS_NODE_PROJECT":"tsconfig.json"}', '512MB', 30],
    ['Python ML', 'python', '3.11.7', 'Machine learning focused Python env', 'active', '["tensorflow","pytorch","transformers","huggingface-hub"]', '{"CUDA_VISIBLE_DEVICES":"0"}', '4GB', 300],
    ['Jupyter Kernel', 'python', '3.11.7', 'Jupyter notebook kernel environment', 'active', '["jupyter","ipykernel","nbformat","ipywidgets"]', '{"JUPYTER_PATH":"/usr/share/jupyter"}', '2GB', 120],
    ['Data Engineering', 'python', '3.11.7', 'ETL and data pipeline tools', 'active', '["apache-airflow","pyspark","dbt-core","great-expectations"]', '{"AIRFLOW_HOME":"/airflow"}', '2GB', 180],
    ['Docker Build', 'shell', 'latest', 'Docker and container tools', 'active', '["docker","docker-compose","buildx","trivy"]', '{"DOCKER_HOST":"unix:///var/run/docker.sock"}', '512MB', 60],
    ['Java 21', 'java', '21.0.1', 'Java LTS with Spring Boot', 'active', '["spring-boot","maven","gradle","lombok"]', '{"JAVA_HOME":"/usr/lib/jvm/java-21"}', '1GB', 60],
    ['Ruby 3.3', 'ruby', '3.3.0', 'Ruby with Rails framework', 'inactive', '["rails","rspec","puma","sidekiq"]', '{"GEM_HOME":"/gems"}', '512MB', 30],
    ['PHP 8.3', 'php', '8.3.1', 'PHP with Laravel framework', 'inactive', '["laravel","composer","phpunit","pest"]', '{"PHP_INI_DIR":"/etc/php"}', '256MB', 30],
    ['C++ 17', 'cpp', '17', 'C++ with Boost and CMake', 'active', '["boost","cmake","gtest","openssl"]', '{"CXX_FLAGS":"-std=c++17"}', '256MB', 30],
    ['Sandbox', 'multi', 'latest', 'Isolated sandbox for untrusted code', 'active', '[]', '{"SANDBOX":"true","NETWORK":"disabled"}', '128MB', 10],
    ['R Statistical', 'r', '4.3.2', 'R for statistical computing', 'active', '["tidyverse","ggplot2","dplyr","shiny"]', '{"R_HOME":"/usr/lib/R"}', '1GB', 60],
  ];
  for (const e of environments) {
    await pool.query('INSERT INTO environments (name,runtime,version,description,status,packages,env_vars,memory_limit,timeout_seconds) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', e);
  }

  // Seed packages
  const packages = [
    ['numpy', '1.26.2', 'python', 'Fundamental package for scientific computing', 'pip install numpy', 'https://numpy.org', 'BSD-3-Clause', 45000000, 'installed'],
    ['pandas', '2.1.4', 'python', 'Data analysis and manipulation library', 'pip install pandas', 'https://pandas.pydata.org', 'BSD-3-Clause', 38000000, 'installed'],
    ['express', '4.18.2', 'javascript', 'Fast minimalist web framework for Node.js', 'npm install express', 'https://expressjs.com', 'MIT', 28000000, 'installed'],
    ['tensorflow', '2.15.0', 'python', 'Open source machine learning framework', 'pip install tensorflow', 'https://tensorflow.org', 'Apache-2.0', 12000000, 'installed'],
    ['react', '18.2.0', 'javascript', 'Library for building user interfaces', 'npm install react', 'https://react.dev', 'MIT', 22000000, 'installed'],
    ['scikit-learn', '1.3.2', 'python', 'Machine learning in Python', 'pip install scikit-learn', 'https://scikit-learn.org', 'BSD-3-Clause', 15000000, 'installed'],
    ['matplotlib', '3.8.2', 'python', 'Comprehensive library for visualizations', 'pip install matplotlib', 'https://matplotlib.org', 'PSF', 11000000, 'installed'],
    ['axios', '1.6.2', 'javascript', 'Promise based HTTP client', 'npm install axios', 'https://axios-http.com', 'MIT', 35000000, 'installed'],
    ['flask', '3.0.0', 'python', 'Lightweight WSGI web application framework', 'pip install flask', 'https://flask.palletsprojects.com', 'BSD-3-Clause', 9000000, 'installed'],
    ['pytorch', '2.1.2', 'python', 'Deep learning framework', 'pip install torch', 'https://pytorch.org', 'BSD-3-Clause', 8000000, 'available'],
    ['gin', '1.9.1', 'go', 'HTTP web framework for Go', 'go get -u github.com/gin-gonic/gin', 'https://gin-gonic.com', 'MIT', 5000000, 'installed'],
    ['lodash', '4.17.21', 'javascript', 'Utility library for JavaScript', 'npm install lodash', 'https://lodash.com', 'MIT', 50000000, 'installed'],
    ['requests', '2.31.0', 'python', 'HTTP library for Python', 'pip install requests', 'https://requests.readthedocs.io', 'Apache-2.0', 30000000, 'installed'],
    ['typescript', '5.3.3', 'javascript', 'Typed superset of JavaScript', 'npm install typescript', 'https://typescriptlang.org', 'Apache-2.0', 20000000, 'installed'],
    ['beautifulsoup4', '4.12.2', 'python', 'HTML and XML parser', 'pip install beautifulsoup4', 'https://www.crummy.com/software/BeautifulSoup/', 'MIT', 7000000, 'installed'],
  ];
  for (const p of packages) {
    await pool.query('INSERT INTO packages (name,version,language,description,install_command,homepage,license,downloads,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', p);
  }

  // Seed visualizations
  const visualizations = [
    ['Execution Time Distribution', 'histogram', 'Distribution of code execution times', 'import matplotlib.pyplot as plt\nplt.hist(times, bins=20)\nplt.xlabel("Time (ms)")\nplt.ylabel("Frequency")\nplt.title("Execution Time Distribution")', '{"bins":20,"color":"#10b981","alpha":0.7}', '{"type":"execution_times","query":"SELECT execution_time_ms FROM executions"}', 'matplotlib', 'active'],
    ['Language Usage Pie Chart', 'pie', 'Breakdown of languages used', 'plt.pie(counts, labels=languages, autopct="%1.1f%%")\nplt.title("Language Usage")', '{"colors":["#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6"]}', '{"type":"language_counts","query":"SELECT language, COUNT(*) FROM code_snippets GROUP BY language"}', 'matplotlib', 'active'],
    ['Memory Usage Timeline', 'line', 'Memory consumption over time', 'plt.plot(timestamps, memory_mb)\nplt.fill_between(timestamps, memory_mb, alpha=0.3)\nplt.xlabel("Time")\nplt.ylabel("Memory (MB)")', '{"line_color":"#f59e0b","fill_alpha":0.3}', '{"type":"memory_timeline","interval":"1h"}', 'matplotlib', 'active'],
    ['Error Rate Heatmap', 'heatmap', 'Error frequency by hour and day', 'import seaborn as sns\nsns.heatmap(error_matrix, annot=True, cmap="YlOrRd")', '{"cmap":"YlOrRd","annot":true}', '{"type":"error_rates","group_by":"hour,day"}', 'seaborn', 'active'],
    ['Package Dependency Graph', 'network', 'Package dependency visualization', 'import networkx as nx\nG = nx.DiGraph()\nG.add_edges_from(deps)\nnx.draw(G, with_labels=True)', '{"layout":"spring","node_size":300}', '{"type":"dependencies"}', 'networkx', 'active'],
    ['Code Complexity Radar', 'radar', 'Multi-dimension code quality metrics', 'fig = go.Figure(go.Scatterpolar(r=values, theta=categories, fill="toself"))', '{"fill":"toself","line_color":"#8b5cf6"}', '{"metrics":["complexity","readability","maintainability","coverage","security"]}', 'plotly', 'active'],
    ['Snippet Growth Bar Chart', 'bar', 'Monthly snippet creation trend', 'plt.bar(months, counts, color="#6366f1")\nplt.xlabel("Month")\nplt.ylabel("Snippets Created")', '{"color":"#6366f1","width":0.8}', '{"type":"monthly_snippets"}', 'matplotlib', 'active'],
    ['Execution Success Rate', 'donut', 'Pass/fail ratio of executions', 'plt.pie(sizes, labels=labels, autopct="%1.1f%%", pctdistance=0.85)\ncircle = plt.Circle((0,0),0.70,fc="white")', '{"colors":["#10b981","#ef4444"],"hole":0.7}', '{"type":"success_rate"}', 'matplotlib', 'active'],
    ['API Latency Scatter', 'scatter', 'API response times with outlier detection', 'plt.scatter(x, y, c=colors, alpha=0.6)\nplt.axhline(y=threshold, color="r", linestyle="--")', '{"alpha":0.6,"threshold_color":"red"}', '{"type":"api_latency","endpoint":"/api/*"}', 'matplotlib', 'active'],
    ['Git Commit Frequency', 'calendar', 'Commit activity calendar heatmap', 'import calplot\ncalplot.calplot(commit_series)', '{"cmap":"Greens","fillcolor":"#f3f4f6"}', '{"type":"git_commits","repo":"main"}', 'calplot', 'active'],
    ['Resource Utilization', 'gauge', 'Current system resource usage', 'fig = go.Figure(go.Indicator(mode="gauge+number", value=cpu_pct, title="CPU Usage"))', '{"ranges":{"green":[0,60],"yellow":[60,80],"red":[80,100]}}', '{"metrics":["cpu","memory","disk"]}', 'plotly', 'active'],
    ['Token Usage Treemap', 'treemap', 'AI token consumption by feature', 'import squarify\nsquarify.plot(sizes=values, label=labels, alpha=0.8)', '{"alpha":0.8,"pad":true}', '{"type":"token_usage","group_by":"feature"}', 'squarify', 'active'],
    ['Correlation Matrix', 'heatmap', 'Variable correlation analysis', 'sns.heatmap(df.corr(), annot=True, cmap="coolwarm", center=0)', '{"cmap":"coolwarm","center":0,"annot":true}', '{"type":"correlation","dataset":"metrics"}', 'seaborn', 'active'],
    ['Benchmark Comparison', 'grouped-bar', 'Algorithm performance comparison', 'x = np.arange(len(labels))\nplt.bar(x - 0.2, algo1, 0.4, label="Algo 1")\nplt.bar(x + 0.2, algo2, 0.4, label="Algo 2")', '{"width":0.4,"colors":["#6366f1","#f59e0b"]}', '{"type":"benchmarks","algorithms":["quicksort","mergesort","heapsort"]}', 'matplotlib', 'active'],
    ['Data Pipeline Flow', 'sankey', 'ETL data flow visualization', 'fig = go.Figure(go.Sankey(node=dict(label=labels), link=dict(source=src, target=tgt, value=vals)))', '{"opacity":0.6}', '{"type":"pipeline_flow","pipeline":"main_etl"}', 'plotly', 'active'],
  ];
  for (const v of visualizations) {
    await pool.query('INSERT INTO visualizations (title,viz_type,description,code,config,data_source,library,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', v);
  }

  // Seed datasets
  const datasets = [
    ['iris.csv', 'Classic Iris flower dataset', 'csv', '7KB', 150, 5, '[{"name":"sepal_length","type":"float"},{"name":"sepal_width","type":"float"},{"name":"petal_length","type":"float"},{"name":"petal_width","type":"float"},{"name":"species","type":"string"}]', '[{"sepal_length":5.1,"sepal_width":3.5,"petal_length":1.4,"petal_width":0.2,"species":"setosa"}]', 'scikit-learn', 'active'],
    ['sales_data.csv', 'Monthly sales transactions for 2024', 'csv', '2.4MB', 50000, 8, '[{"name":"date","type":"date"},{"name":"product","type":"string"},{"name":"quantity","type":"int"},{"name":"price","type":"float"},{"name":"region","type":"string"}]', '[{"date":"2024-01-15","product":"Widget A","quantity":5,"price":29.99,"region":"North"}]', 'internal', 'active'],
    ['user_events.json', 'User clickstream event data', 'json', '15.8MB', 250000, 12, '[{"name":"user_id","type":"string"},{"name":"event_type","type":"string"},{"name":"timestamp","type":"datetime"},{"name":"page","type":"string"}]', '[{"user_id":"u001","event_type":"click","timestamp":"2024-01-15T10:30:00Z","page":"/home"}]', 'analytics', 'active'],
    ['employees.csv', 'Company employee directory', 'csv', '890KB', 5000, 10, '[{"name":"id","type":"int"},{"name":"name","type":"string"},{"name":"department","type":"string"},{"name":"salary","type":"float"},{"name":"hire_date","type":"date"}]', '[{"id":1,"name":"Alice Smith","department":"Engineering","salary":95000,"hire_date":"2020-03-15"}]', 'hr-system', 'active'],
    ['weather_hourly.parquet', 'Hourly weather observations', 'parquet', '45MB', 876000, 15, '[{"name":"timestamp","type":"datetime"},{"name":"temperature","type":"float"},{"name":"humidity","type":"float"},{"name":"pressure","type":"float"}]', '[{"timestamp":"2024-01-01T00:00:00","temperature":32.5,"humidity":0.65,"pressure":1013.2}]', 'noaa', 'active'],
    ['stock_prices.csv', 'Daily stock prices for S&P 500', 'csv', '120MB', 1250000, 7, '[{"name":"date","type":"date"},{"name":"ticker","type":"string"},{"name":"open","type":"float"},{"name":"close","type":"float"},{"name":"volume","type":"int"}]', '[{"date":"2024-01-02","ticker":"AAPL","open":187.15,"close":185.64,"volume":58414460}]', 'yahoo-finance', 'active'],
    ['server_logs.log', 'Nginx access log data', 'log', '500MB', 5000000, 6, '[{"name":"timestamp","type":"datetime"},{"name":"method","type":"string"},{"name":"path","type":"string"},{"name":"status","type":"int"},{"name":"response_time","type":"float"}]', '[]', 'nginx', 'active'],
    ['customer_reviews.json', 'Product reviews with sentiment', 'json', '8.2MB', 75000, 6, '[{"name":"id","type":"string"},{"name":"text","type":"string"},{"name":"rating","type":"int"},{"name":"sentiment","type":"string"}]', '[{"id":"r001","text":"Great product!","rating":5,"sentiment":"positive"}]', 'scraped', 'active'],
    ['geolocation.csv', 'IP geolocation lookup data', 'csv', '230MB', 3000000, 8, '[{"name":"ip_start","type":"string"},{"name":"ip_end","type":"string"},{"name":"country","type":"string"},{"name":"city","type":"string"},{"name":"lat","type":"float"},{"name":"lon","type":"float"}]', '[]', 'maxmind', 'active'],
    ['mnist_train.npz', 'MNIST handwritten digits', 'npz', '11MB', 60000, 2, '[{"name":"images","type":"array(28x28)"},{"name":"labels","type":"int"}]', '[]', 'keras-datasets', 'active'],
    ['network_traffic.pcap', 'Network packet capture data', 'pcap', '1.2GB', 8500000, 14, '[{"name":"timestamp","type":"datetime"},{"name":"src_ip","type":"string"},{"name":"dst_ip","type":"string"},{"name":"protocol","type":"string"},{"name":"length","type":"int"}]', '[]', 'wireshark', 'active'],
    ['genome_sequences.fasta', 'DNA sequence data', 'fasta', '350MB', 15000, 3, '[{"name":"id","type":"string"},{"name":"description","type":"string"},{"name":"sequence","type":"string"}]', '[]', 'ncbi', 'inactive'],
    ['transactions.csv', 'Credit card transaction data', 'csv', '67MB', 284807, 31, '[{"name":"time","type":"float"},{"name":"amount","type":"float"},{"name":"class","type":"int"}]', '[{"time":0,"amount":149.62,"class":0}]', 'kaggle', 'active'],
    ['covid_global.csv', 'Global COVID-19 case data', 'csv', '15MB', 200000, 8, '[{"name":"date","type":"date"},{"name":"country","type":"string"},{"name":"cases","type":"int"},{"name":"deaths","type":"int"},{"name":"vaccinations","type":"int"}]', '[]', 'who', 'active'],
    ['api_benchmark.json', 'API performance benchmark results', 'json', '3.5MB', 100000, 9, '[{"name":"endpoint","type":"string"},{"name":"method","type":"string"},{"name":"response_time_ms","type":"float"},{"name":"status_code","type":"int"}]', '[{"endpoint":"/api/users","method":"GET","response_time_ms":45.2,"status_code":200}]', 'internal', 'active'],
  ];
  for (const d of datasets) {
    await pool.query('INSERT INTO datasets (name,description,format,size,row_count,column_count,schema_def,sample_data,source,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', d);
  }

  // Seed code reviews
  const reviews = [
    ['API Route Handler Review', 'javascript', 'app.get("/api/users", async (req, res) => {\n  const users = await db.query("SELECT * FROM users WHERE name = " + req.query.name);\n  res.json(users);\n});', 'security', 3, 'F', 'Critical SQL injection vulnerability found', '[{"severity":"critical","message":"SQL injection via string concatenation","line":2}]', '[{"message":"Use parameterized queries","priority":"critical"}]', 'completed'],
    ['React Component Review', 'typescript', 'const UserList = () => {\n  const [users, setUsers] = useState([]);\n  useEffect(() => {\n    fetch("/api/users").then(r => r.json()).then(setUsers);\n  });\n  return users.map(u => <div key={u.id}>{u.name}</div>);\n};', 'clean-code', 6, 'C', 'Missing dependency array causes infinite re-renders', '[{"severity":"high","message":"useEffect missing dependency array","line":4}]', '[{"message":"Add empty dependency array []","priority":"high"}]', 'completed'],
    ['Python Data Pipeline', 'python', 'def process_data(filepath):\n    data = open(filepath).read()\n    records = json.loads(data)\n    results = []\n    for r in records:\n        results.append(transform(r))\n    return results', 'performance', 7, 'B', 'File handle not closed, could use list comprehension', '[{"severity":"medium","message":"File handle not closed properly","line":2}]', '[{"message":"Use with statement for file operations","priority":"medium"}]', 'completed'],
    ['Authentication Middleware', 'javascript', 'function auth(req, res, next) {\n  const token = req.headers.authorization;\n  if (!token) return res.status(401).send("No token");\n  const decoded = jwt.verify(token, "hardcoded-secret");\n  req.user = decoded;\n  next();\n}', 'security', 4, 'D', 'Hardcoded secret and no error handling', '[{"severity":"critical","message":"Hardcoded JWT secret","line":4},{"severity":"high","message":"No try-catch around jwt.verify","line":4}]', '[{"message":"Use environment variable for secret","priority":"critical"}]', 'completed'],
    ['Database Query Builder', 'python', 'class QueryBuilder:\n    def __init__(self, table):\n        self.table = table\n        self.conditions = []\n    \n    def where(self, field, value):\n        self.conditions.append(f"{field} = \'{value}\'")\n        return self\n    \n    def build(self):\n        sql = f"SELECT * FROM {self.table}"\n        if self.conditions:\n            sql += " WHERE " + " AND ".join(self.conditions)\n        return sql', 'security', 3, 'F', 'SQL injection through string formatting', '[{"severity":"critical","message":"SQL injection in where clause","line":7}]', '[{"message":"Use parameterized queries instead of string formatting","priority":"critical"}]', 'completed'],
    ['Async File Processor', 'javascript', 'async function processFiles(dir) {\n  const files = fs.readdirSync(dir);\n  for (const file of files) {\n    const content = fs.readFileSync(path.join(dir, file));\n    await uploadToS3(content);\n  }\n}', 'performance', 5, 'C', 'Synchronous file operations in async function', '[{"severity":"high","message":"Using sync fs operations in async function","line":2}]', '[{"message":"Use fs.promises for async file operations","priority":"high"}]', 'completed'],
    ['Error Handler', 'python', 'def divide(a, b):\n    try:\n        return a / b\n    except:\n        return None', 'clean-code', 5, 'C-', 'Bare except catches everything including SystemExit', '[{"severity":"medium","message":"Bare except clause","line":4}]', '[{"message":"Catch specific exceptions like ZeroDivisionError","priority":"medium"}]', 'completed'],
    ['REST Controller', 'java', 'public class UserController {\n  @GetMapping("/users")\n  public List<User> getUsers() {\n    return userRepo.findAll();\n  }\n  @PostMapping("/users")\n  public User createUser(@RequestBody User user) {\n    return userRepo.save(user);\n  }\n}', 'architecture', 7, 'B', 'Missing validation, error handling, and pagination', '[{"severity":"medium","message":"No input validation on POST","line":7}]', '[{"message":"Add @Valid annotation and pagination","priority":"medium"}]', 'completed'],
    ['Caching Implementation', 'python', 'cache = {}\n\ndef get_user(user_id):\n    if user_id in cache:\n        return cache[user_id]\n    user = db.query(f"SELECT * FROM users WHERE id = {user_id}")\n    cache[user_id] = user\n    return user', 'full', 4, 'D', 'No cache expiration, SQL injection, unbounded cache', '[{"severity":"critical","message":"SQL injection","line":6},{"severity":"high","message":"Unbounded cache growth","line":1}]', '[{"message":"Use LRU cache with TTL and parameterized queries","priority":"critical"}]', 'completed'],
    ['WebSocket Handler', 'javascript', 'wss.on("connection", (ws) => {\n  ws.on("message", (data) => {\n    const msg = JSON.parse(data);\n    wss.clients.forEach(client => {\n      client.send(JSON.stringify(msg));\n    });\n  });\n});', 'security', 6, 'C', 'No input validation or authentication', '[{"severity":"high","message":"No message validation or sanitization","line":3}]', '[{"message":"Validate and sanitize incoming messages","priority":"high"}]', 'completed'],
    ['Config Loader', 'go', 'func LoadConfig(path string) Config {\n\tdata, _ := os.ReadFile(path)\n\tvar config Config\n\tjson.Unmarshal(data, &config)\n\treturn config\n}', 'bugs', 4, 'D', 'Ignoring errors from ReadFile and Unmarshal', '[{"severity":"high","message":"Error return value ignored","line":2},{"severity":"high","message":"Error return value ignored","line":4}]', '[{"message":"Handle all error return values","priority":"high"}]', 'completed'],
    ['Password Hasher', 'python', 'import hashlib\n\ndef hash_password(password):\n    return hashlib.md5(password.encode()).hexdigest()\n\ndef verify_password(password, hashed):\n    return hash_password(password) == hashed', 'security', 2, 'F', 'MD5 is cryptographically broken for passwords', '[{"severity":"critical","message":"Using MD5 for password hashing","line":4}]', '[{"message":"Use bcrypt, argon2, or scrypt instead","priority":"critical"}]', 'completed'],
    ['Rate Limiter', 'javascript', 'const rateLimit = {};\n\nfunction checkLimit(ip) {\n  if (!rateLimit[ip]) rateLimit[ip] = { count: 0, reset: Date.now() + 60000 };\n  if (Date.now() > rateLimit[ip].reset) {\n    rateLimit[ip] = { count: 0, reset: Date.now() + 60000 };\n  }\n  rateLimit[ip].count++;\n  return rateLimit[ip].count <= 100;\n}', 'performance', 6, 'C', 'In-memory rate limiter does not work across instances', '[{"severity":"medium","message":"No cleanup of expired entries","line":1}]', '[{"message":"Use Redis for distributed rate limiting","priority":"medium"}]', 'completed'],
    ['CSV Parser', 'python', 'def parse_csv(text):\n    lines = text.strip().split("\\n")\n    headers = lines[0].split(",")\n    return [\n        dict(zip(headers, line.split(",")))\n        for line in lines[1:]\n    ]', 'bugs', 5, 'C', 'Does not handle quoted fields or escaped commas', '[{"severity":"high","message":"Naive CSV parsing breaks on quoted fields","line":5}]', '[{"message":"Use csv module from standard library","priority":"high"}]', 'completed'],
    ['Retry Decorator', 'python', 'import time\nimport functools\n\ndef retry(max_attempts=3, delay=1):\n    def decorator(func):\n        @functools.wraps(func)\n        def wrapper(*args, **kwargs):\n            for attempt in range(max_attempts):\n                try:\n                    return func(*args, **kwargs)\n                except Exception:\n                    if attempt == max_attempts - 1:\n                        raise\n                    time.sleep(delay)\n        return wrapper\n    return decorator', 'clean-code', 8, 'A-', 'Clean implementation, could add exponential backoff', '[{"severity":"low","message":"Fixed delay instead of exponential backoff","line":14}]', '[{"message":"Consider adding jitter and exponential backoff","priority":"low"}]', 'completed'],
  ];
  for (const r of reviews) {
    await pool.query('INSERT INTO code_reviews (title,language,code,review_type,score,grade,summary,issues,suggestions,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', r);
  }

  // Seed code templates
  const templates = [
    ['Flask REST API', 'python', 'web', 'Flask REST API boilerplate with CRUD', 'from flask import Flask, jsonify, request\n\napp = Flask(__name__)\nitems = []\n\n@app.route("/api/items", methods=["GET"])\ndef get_items():\n    return jsonify(items)\n\n@app.route("/api/items", methods=["POST"])\ndef create_item():\n    item = request.json\n    items.append(item)\n    return jsonify(item), 201\n\nif __name__ == "__main__":\n    app.run(debug=True)', '[{"name":"MODEL_NAME","default":"Item"},{"name":"PORT","default":"5000"}]', 156, true],
    ['Express API', 'javascript', 'web', 'Express.js REST API starter', 'const express = require("express");\nconst app = express();\napp.use(express.json());\n\napp.get("/api/health", (req, res) => res.json({status: "ok"}));\n\napp.listen(3000, () => console.log("Running on 3000"));', '[{"name":"PORT","default":"3000"}]', 234, true],
    ['Python CLI Tool', 'python', 'cli', 'Command-line tool with argparse', 'import argparse\n\ndef main():\n    parser = argparse.ArgumentParser(description="${DESCRIPTION}")\n    parser.add_argument("input", help="Input file")\n    parser.add_argument("-o", "--output", default="output.txt")\n    parser.add_argument("-v", "--verbose", action="store_true")\n    args = parser.parse_args()\n    print(f"Processing {args.input}")\n\nif __name__ == "__main__":\n    main()', '[{"name":"DESCRIPTION","default":"My CLI Tool"}]', 89, true],
    ['React Component', 'typescript', 'frontend', 'Typed React functional component', 'import React, { useState, useEffect } from "react";\n\ninterface ${NAME}Props {\n  title: string;\n}\n\nexport const ${NAME}: React.FC<${NAME}Props> = ({ title }) => {\n  const [data, setData] = useState<any[]>([]);\n\n  useEffect(() => {\n    // Fetch data\n  }, []);\n\n  return (\n    <div>\n      <h1>{title}</h1>\n    </div>\n  );\n};', '[{"name":"NAME","default":"MyComponent"}]', 198, true],
    ['Unit Test Suite', 'python', 'testing', 'Pytest test suite template', 'import pytest\n\nclass Test${CLASS}:\n    def setup_method(self):\n        self.instance = ${CLASS}()\n\n    def test_creation(self):\n        assert self.instance is not None\n\n    def test_basic_operation(self):\n        result = self.instance.do_something()\n        assert result == expected\n\n    @pytest.mark.parametrize("input,expected", [(1, 1), (2, 4)])\n    def test_parametrized(self, input, expected):\n        assert self.instance.compute(input) == expected', '[{"name":"CLASS","default":"Calculator"}]', 145, true],
    ['Docker Compose', 'yaml', 'devops', 'Docker Compose multi-service setup', 'version: "3.8"\nservices:\n  app:\n    build: .\n    ports:\n      - "${PORT}:${PORT}"\n    environment:\n      - DATABASE_URL=postgresql://postgres:postgres@db:5432/${DB_NAME}\n    depends_on:\n      - db\n  db:\n    image: postgres:15\n    environment:\n      POSTGRES_DB: ${DB_NAME}\n      POSTGRES_PASSWORD: postgres\n    volumes:\n      - pgdata:/var/lib/postgresql/data\nvolumes:\n  pgdata:', '[{"name":"PORT","default":"3000"},{"name":"DB_NAME","default":"myapp"}]', 112, true],
    ['FastAPI CRUD', 'python', 'web', 'FastAPI with Pydantic models', 'from fastapi import FastAPI, HTTPException\nfrom pydantic import BaseModel\n\napp = FastAPI()\n\nclass Item(BaseModel):\n    name: str\n    price: float\n\nitems = {}\n\n@app.get("/items/{item_id}")\ndef read_item(item_id: int):\n    if item_id not in items:\n        raise HTTPException(status_code=404)\n    return items[item_id]', '[{"name":"MODEL","default":"Item"}]', 167, true],
    ['GitHub Actions CI', 'yaml', 'ci-cd', 'GitHub Actions workflow for Node.js', 'name: CI\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - run: npm ci\n      - run: npm test', '[{"name":"NODE_VERSION","default":"20"}]', 98, true],
    ['WebSocket Server', 'javascript', 'realtime', 'WebSocket server with rooms', 'const WebSocket = require("ws");\nconst wss = new WebSocket.Server({ port: ${PORT} });\nconst rooms = new Map();\n\nwss.on("connection", (ws) => {\n  ws.on("message", (data) => {\n    const { type, room, message } = JSON.parse(data);\n    if (type === "join") rooms.set(ws, room);\n    if (type === "message") broadcast(room, message);\n  });\n});', '[{"name":"PORT","default":"8080"}]', 76, true],
    ['Terraform Module', 'hcl', 'infrastructure', 'Terraform AWS resource module', 'variable "name" {\n  type = string\n}\n\nresource "aws_instance" "main" {\n  ami           = "${AMI_ID}"\n  instance_type = "t3.micro"\n  tags = {\n    Name = var.name\n  }\n}', '[{"name":"AMI_ID","default":"ami-0c55b159cbfafe1f0"}]', 54, true],
    ['Go HTTP Server', 'go', 'web', 'Go net/http server with routing', 'package main\n\nimport (\n\t"encoding/json"\n\t"net/http"\n)\n\nfunc main() {\n\thttp.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {\n\t\tjson.NewEncoder(w).Encode(map[string]string{"status": "ok"})\n\t})\n\thttp.ListenAndServe(":${PORT}", nil)\n}', '[{"name":"PORT","default":"8080"}]', 67, true],
    ['Rust CLI', 'rust', 'cli', 'Rust command-line application with Clap', 'use clap::Parser;\n\n#[derive(Parser)]\nstruct Args {\n    /// Input file path\n    input: String,\n    /// Output file path\n    #[arg(short, long, default_value = "output.txt")]\n    output: String,\n    /// Verbose output\n    #[arg(short, long)]\n    verbose: bool,\n}\n\nfn main() {\n    let args = Args::parse();\n    println!("Processing {}", args.input);\n}', '[{"name":"NAME","default":"my-tool"}]', 43, true],
    ['SQLAlchemy Model', 'python', 'database', 'SQLAlchemy ORM model definition', 'from sqlalchemy import Column, Integer, String, DateTime, create_engine\nfrom sqlalchemy.orm import declarative_base\nfrom datetime import datetime\n\nBase = declarative_base()\n\nclass ${MODEL}(Base):\n    __tablename__ = "${TABLE}"\n    id = Column(Integer, primary_key=True)\n    name = Column(String(255), nullable=False)\n    created_at = Column(DateTime, default=datetime.utcnow)', '[{"name":"MODEL","default":"User"},{"name":"TABLE","default":"users"}]', 134, true],
    ['Makefile', 'makefile', 'build', 'Project Makefile with common targets', '.PHONY: build test clean run\n\nbuild:\n\t@echo "Building..."\n\tgo build -o bin/${NAME} ./cmd/${NAME}\n\ntest:\n\tgo test ./...\n\nclean:\n\trm -rf bin/\n\nrun: build\n\t./bin/${NAME}', '[{"name":"NAME","default":"myapp"}]', 87, true],
    ['Nginx Config', 'nginx', 'devops', 'Nginx reverse proxy configuration', 'server {\n    listen 80;\n    server_name ${DOMAIN};\n\n    location / {\n        proxy_pass http://localhost:${PORT};\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n        proxy_set_header Host $host;\n    }\n}', '[{"name":"DOMAIN","default":"example.com"},{"name":"PORT","default":"3000"}]', 92, true],
  ];
  for (const t of templates) {
    await pool.query('INSERT INTO code_templates (name,language,category,description,code,variables,usage_count,is_public) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', t);
  }

  // Seed execution history
  const history = [
    [1, 'python', 'fibonacci(20) -> [0, 1, 1, 2, 3, 5...', 'completed', 12, 0, 'manual'],
    [2, 'python', 'quicksort([3,6,8,10,1,2,1]) -> [1,1,2...', 'completed', 8, 0, 'manual'],
    [3, 'javascript', 'express server on port 3000', 'completed', 145, 0, 'manual'],
    [6, 'python', 'df.describe() -> statistical summary', 'completed', 45, 0, 'notebook'],
    [7, 'python', 'scrape_page("https://example.com")', 'completed', 892, 0, 'manual'],
    [10, 'typescript', 'useFetch<User[]>("/api/users")', 'completed', 23, 0, 'manual'],
    [4, 'python', 'BST insert operations', 'completed', 5, 0, 'notebook'],
    [5, 'javascript', 'JWT token generation', 'completed', 3, 0, 'api'],
    [8, 'javascript', 'fetchData with Promise.all', 'completed', 234, 0, 'manual'],
    [9, 'python', 'PostgreSQL connection pool', 'failed', 5012, 1, 'manual'],
    [11, 'go', 'mergeSort benchmark', 'completed', 6, 0, 'manual'],
    [12, 'python', 'Docker Compose generation', 'completed', 15, 0, 'notebook'],
    [13, 'python', 'LRU Cache operations', 'completed', 2, 0, 'manual'],
    [14, 'javascript', 'Apollo GraphQL server start', 'completed', 340, 0, 'manual'],
    [15, 'python', 'Regex validation tests', 'completed', 1, 0, 'api'],
  ];
  for (const h of history) {
    await pool.query('INSERT INTO execution_history (snippet_id,language,code_preview,status,execution_time_ms,exit_code,triggered_by) VALUES ($1,$2,$3,$4,$5,$6,$7)', h);
  }

  // Seed secrets
  const secrets = [
    ['OPENROUTER_API_KEY', 'OpenRouter AI API key', 'api_key', 'sk-or-****...9f2a', 'all', null, 'active'],
    ['DATABASE_URL', 'PostgreSQL connection string', 'connection_string', 'postgresql://****@localhost/...', 'all', null, 'active'],
    ['GITHUB_TOKEN', 'GitHub personal access token', 'api_key', 'ghp_****...x8k2', 'development', null, 'active'],
    ['AWS_ACCESS_KEY_ID', 'AWS access key', 'api_key', 'AKIA****...3QVW', 'production', null, 'active'],
    ['AWS_SECRET_ACCESS_KEY', 'AWS secret key', 'api_key', '****...masked', 'production', null, 'active'],
    ['REDIS_URL', 'Redis connection URL', 'connection_string', 'redis://****@localhost:6379', 'all', null, 'active'],
    ['SMTP_PASSWORD', 'Email SMTP password', 'password', '****...masked', 'production', null, 'active'],
    ['STRIPE_SECRET_KEY', 'Stripe payment API key', 'api_key', 'sk_test_****...7h3j', 'development', null, 'inactive'],
    ['JWT_SECRET', 'JWT signing secret', 'secret', '****...masked', 'all', null, 'active'],
    ['SENTRY_DSN', 'Sentry error tracking DSN', 'dsn', 'https://****@sentry.io/...', 'production', null, 'active'],
    ['SLACK_WEBHOOK', 'Slack notification webhook', 'webhook', 'https://hooks.slack.com/****', 'all', null, 'active'],
    ['NPM_TOKEN', 'NPM registry auth token', 'api_key', 'npm_****...m2k9', 'ci', null, 'active'],
    ['DOCKER_HUB_TOKEN', 'Docker Hub access token', 'api_key', 'dckr_****...p4n1', 'ci', null, 'active'],
    ['ENCRYPTION_KEY', 'AES-256 encryption key', 'secret', '****...masked', 'production', null, 'active'],
    ['TWILIO_AUTH_TOKEN', 'Twilio SMS auth token', 'api_key', '****...masked', 'production', null, 'inactive'],
  ];
  for (const s of secrets) {
    await pool.query('INSERT INTO secrets (name,description,secret_type,masked_value,environment,last_used,status) VALUES ($1,$2,$3,$4,$5,$6,$7)', s);
  }

  // Seed collaborators
  const collabs = [
    [1, 'alice@dev.com', 'editor', 'edit,execute,comment', 'active', 'admin@codeinterpreter.ai'],
    [1, 'bob@dev.com', 'viewer', 'view,comment', 'active', 'admin@codeinterpreter.ai'],
    [2, 'charlie@dev.com', 'editor', 'edit,execute', 'active', 'admin@codeinterpreter.ai'],
    [3, 'diana@dev.com', 'admin', 'full', 'active', 'admin@codeinterpreter.ai'],
    [4, 'eve@dev.com', 'editor', 'edit,execute,comment', 'active', 'admin@codeinterpreter.ai'],
    [5, 'frank@dev.com', 'viewer', 'view', 'active', 'admin@codeinterpreter.ai'],
    [6, 'grace@dev.com', 'editor', 'edit,execute', 'active', 'admin@codeinterpreter.ai'],
    [8, 'henry@dev.com', 'editor', 'edit,comment', 'active', 'admin@codeinterpreter.ai'],
    [9, 'ivy@dev.com', 'viewer', 'view,comment', 'active', 'admin@codeinterpreter.ai'],
    [10, 'jack@dev.com', 'admin', 'full', 'active', 'admin@codeinterpreter.ai'],
    [11, 'kate@dev.com', 'editor', 'edit,execute', 'active', 'admin@codeinterpreter.ai'],
    [12, 'leo@dev.com', 'viewer', 'view', 'active', 'admin@codeinterpreter.ai'],
    [13, 'mia@dev.com', 'editor', 'edit,execute,comment', 'active', 'admin@codeinterpreter.ai'],
    [14, 'noah@dev.com', 'editor', 'edit,comment', 'active', 'admin@codeinterpreter.ai'],
    [15, 'olivia@dev.com', 'viewer', 'view,comment', 'active', 'admin@codeinterpreter.ai'],
  ];
  for (const c of collabs) {
    await pool.query('INSERT INTO collaborators (notebook_id,user_email,role,permissions,status,invited_by) VALUES ($1,$2,$3,$4,$5,$6)', c);
  }

  // Seed execution logs
  const logs = [
    [1, 'info', 'Execution started for snippet #1', 'executor', 1, 1710000000000, '{"trigger":"manual"}'],
    [1, 'info', 'Python 3.11 environment loaded', 'runtime', null, 1710000000050, '{"env":"python-3.11"}'],
    [1, 'info', 'Execution completed successfully', 'executor', null, 1710000000062, '{"exit_code":0}'],
    [2, 'info', 'Execution started for snippet #2', 'executor', 1, 1710000001000, '{"trigger":"manual"}'],
    [2, 'info', 'Execution completed in 8ms', 'executor', null, 1710000001008, '{"exit_code":0}'],
    [3, 'info', 'Node.js 20 environment loaded', 'runtime', null, 1710000002000, '{"env":"nodejs-20"}'],
    [3, 'warning', 'Port 3000 already in use, trying 3001', 'runtime', 5, 1710000002100, '{"port":3001}'],
    [3, 'info', 'Server started on port 3001', 'executor', null, 1710000002145, '{}'],
    [10, 'error', 'Connection refused: localhost:5432', 'runtime', 1, 1710000010000, '{"host":"localhost","port":5432}'],
    [10, 'error', 'Execution failed with exit code 1', 'executor', null, 1710000015012, '{"exit_code":1}'],
    [4, 'info', 'Importing pandas 2.1.4', 'runtime', 1, 1710000003000, '{"library":"pandas"}'],
    [4, 'info', 'DataFrame created with shape (4, 3)', 'executor', 3, 1710000003045, '{"rows":4,"cols":3}'],
    [6, 'info', 'TypeScript 5.3 compiler loaded', 'runtime', null, 1710000006000, '{"typescript":"5.3.3"}'],
    [6, 'info', 'Type checking passed', 'compiler', null, 1710000006015, '{}'],
    [8, 'info', 'Promise.all resolved 2 URLs', 'executor', 3, 1710000008234, '{"urls_resolved":2}'],
  ];
  for (const l of logs) {
    await pool.query('INSERT INTO execution_logs (execution_id,level,message,source,line_number,timestamp_ms,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)', l);
  }

  // Seed settings
  const settings = [
    ['default_language', 'python', 'editor', 'Default programming language'],
    ['auto_execute', 'false', 'execution', 'Auto-execute code on save'],
    ['theme', 'dark', 'appearance', 'Editor color theme'],
    ['font_size', '14', 'editor', 'Editor font size in pixels'],
    ['font_family', 'JetBrains Mono', 'editor', 'Editor font family'],
    ['tab_size', '4', 'editor', 'Number of spaces per tab'],
    ['line_numbers', 'true', 'editor', 'Show line numbers'],
    ['word_wrap', 'false', 'editor', 'Enable word wrapping'],
    ['auto_save', 'true', 'general', 'Auto-save snippets'],
    ['execution_timeout', '30', 'execution', 'Default timeout in seconds'],
    ['max_output_lines', '1000', 'execution', 'Maximum output lines to display'],
    ['ai_model', 'anthropic/claude-haiku-4.5', 'ai', 'AI model for code analysis'],
    ['ai_temperature', '0.7', 'ai', 'AI response temperature'],
    ['enable_vim_mode', 'false', 'editor', 'Enable Vim keybindings'],
    ['minimap', 'true', 'editor', 'Show code minimap'],
  ];
  for (const s of settings) {
    await pool.query('INSERT INTO settings (key,value,category,description) VALUES ($1,$2,$3,$4)', s);
  }

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch(err => { console.error('Seed error:', err); process.exit(1); });
