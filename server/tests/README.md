# API smoke tests

In-memory SQLite; no production DB required.

```bash
cd server
pipenv install --dev
pipenv run pytest tests -v
```

Or from the project root:

```bash
pipenv run pytest server/tests -v
```
