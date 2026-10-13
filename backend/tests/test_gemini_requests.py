from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from grammar_check import gemini_requests
from grammar_check import grammar_module, grammar_module_ta


class ProviderError(Exception):
    def __init__(self, code):
        self.code = code


@pytest.mark.parametrize("module", [grammar_module, grammar_module_ta])
def test_grammar_recovers_from_service_unavailable(module, monkeypatch):
    pause = Mock()
    monkeypatch.setattr(gemini_requests.time, "sleep", pause)
    response = SimpleNamespace(text='{"sentences": []}')
    call = Mock(side_effect=[ProviderError(503), response])
    client = SimpleNamespace(models=SimpleNamespace(generate_content=call))
    assert module._call_gemini_json(client, "test-model", "test-prompt") == {"sentences": []}
    assert call.call_count == 2
    pause.assert_called_once_with(1)
    assert call.call_args.kwargs["config"]["automatic_function_calling"]["disable"]


def test_persistent_unavailability_is_bounded(monkeypatch):
    pause = Mock()
    monkeypatch.setattr(gemini_requests.time, "sleep", pause)
    call = Mock(side_effect=ProviderError(503))
    client = SimpleNamespace(models=SimpleNamespace(generate_content=call))
    with pytest.raises(ProviderError):
        gemini_requests.generate_content(client, model="test", contents=["test"])
    assert call.call_count == 3
    assert [c.args[0] for c in pause.call_args_list] == [1, 2]


@pytest.mark.parametrize("code", [400, 401, 403, 404])
def test_configuration_errors_are_not_retried(code, monkeypatch):
    pause = Mock()
    monkeypatch.setattr(gemini_requests.time, "sleep", pause)
    call = Mock(side_effect=ProviderError(code))
    client = SimpleNamespace(models=SimpleNamespace(generate_content=call))
    with pytest.raises(ProviderError):
        gemini_requests.generate_content(client, model="test", contents=["test"])
    assert call.call_count == 1
    pause.assert_not_called()


def test_model_override(monkeypatch):
    monkeypatch.setenv("GEMINI_MODEL", " chosen-model ")
    assert gemini_requests.configured_model() == "chosen-model"
    monkeypatch.setenv("GEMINI_MODEL", " ")
    assert gemini_requests.configured_model() == gemini_requests.DEFAULT_MODEL


@pytest.mark.parametrize("module", [grammar_module, grammar_module_ta])
def test_persistent_503_uses_available_text_model(module, monkeypatch):
    monkeypatch.setattr(gemini_requests.time, "sleep", Mock())
    response = SimpleNamespace(text='{"sentences": [{"idx": 0, "corrected": "corrected"}]}')
    call = Mock(side_effect=[ProviderError(503)] * 3 + [response])
    models = SimpleNamespace(generate_content=call, list=Mock(return_value=[
        SimpleNamespace(name="models/gemini-preview-flash", supported_actions=["generateContent"]),
        SimpleNamespace(name="models/gemini-2.5-flash", supported_actions=["generateContent"]),
    ]))
    result = module._call_gemini_json(SimpleNamespace(models=models), "original", "prompt")
    assert result["sentences"][0]["corrected"] == "corrected"
    assert call.call_args.kwargs["model"] == "gemini-2.5-flash"


def test_fallback_failure_remains_failure(monkeypatch):
    monkeypatch.setattr(gemini_requests.time, "sleep", Mock())
    call = Mock(side_effect=ProviderError(503))
    models = SimpleNamespace(generate_content=call, list=Mock(return_value=[
        SimpleNamespace(name="models/gemini-2.5-flash", supported_actions=["generateContent"]),
    ]))
    with pytest.raises(ProviderError):
        gemini_requests.generate_content(SimpleNamespace(models=models), model="original", contents=["prompt"])
    assert call.call_count == 4
