# Periferia IT Group — Challenge 02

## Contract Reception Conversational Agent

## Live Demo

The application is publicly deployed on Render.

**Live URL:**

https://periferia-contract-reception-agent.onrender.com

**Health endpoint:**

https://periferia-contract-reception-agent.onrender.com/api/health

The deployed application includes:

- conversational contract processing;
- visible tool execution;
- deterministic validation;
- human-in-the-loop confirmation;
- simulated SharePoint registration;
- contract alerts.

The deployment uses environment variables for runtime secrets and does not expose API keys in the source repository.

---

# 1. Solution Overview

This solution implements a conversational contract-reception agent for Periferia IT Group.

The application receives simulated contract emails and supports:

- inbox inspection;
- contract and amendment classification;
- structured contract-data extraction;
- confidence scoring;
- deterministic validation;
- duplicate detection;
- amendment detection;
- simulated SharePoint registration;
- document archiving;
- human confirmation for uncertain fields;
- contract expiration alerts;
- policy-status alerts;
- conversational interaction through a web interface.

The solution is implemented in TypeScript using Node.js.

A key design principle is that the language model is not responsible for enforcing business rules.

The language model acts as an orchestration and communication layer, while deterministic TypeScript tools perform extraction, validation, registration, and alert generation.

---

# 2. Architecture

The system is divided into four main layers.

```text
User
  |
  v
Web Chat Frontend
  |
  v
Express Backend
  |
  v
Conversational Agent / LLM
  |
  v
Deterministic Contract Tools
  |
  +---- leer_buzon
  +---- extraer
  +---- validar
  +---- registrar
  +---- alertas
  |
  v
Simulated SharePoint Output