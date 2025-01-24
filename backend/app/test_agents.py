import os
import pytest
from crewai import Agent, Task
from agents import GroqAnalysisTool, WritingTasks

def test_groq_tool_creation():
    tool = GroqAnalysisTool(
        api_key="test-key",
        model="test-model"
    )
    assert hasattr(tool, 'name')
    assert hasattr(tool, 'description')
    assert hasattr(tool, 'func')
    assert tool.name == "analyze_with_groq"
    assert tool.description == "Tool for analyzing text using Groq API"

def test_agent_with_groq_tool():
    tool = GroqAnalysisTool(
        api_key="test-key",
        model="test-model"
    )
    agent = Agent(
        name="Test Agent",
        role="Test Role",
        goal="Test Goal",
        backstory="Test Backstory",
        tools=[tool],
        verbose=True
    )
    assert len(agent.tools) == 1
    assert agent.tools[0].name == "analyze_with_groq"
    assert "Tool for analyzing text using Groq API" in agent.tools[0].description

def test_task_creation():
    tool = GroqAnalysisTool(
        api_key="test-key",
        model="test-model"
    )
    agent = Agent(
        name="Test Agent",
        role="Test Role",
        goal="Test Goal",
        backstory="Test Backstory",
        tools=[tool],
        verbose=True
    )
    task = WritingTasks.create_analysis_task(
        agent=agent,
        text="Test text",
        style="formal"
    )
    assert isinstance(task, Task)
    assert isinstance(task.expected_output, str) 