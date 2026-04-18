from src.edc.forecast import linear_forecast


def test_linear_forecast_returns_correct_shape():
    historical = [2, 4, 6, 8, 10]
    result = linear_forecast(historical, horizon=3)
    assert "forecast" in result
    assert "lower" in result
    assert "upper" in result
    assert len(result["forecast"]) == 3
    assert len(result["lower"]) == 3
    assert len(result["upper"]) == 3


def test_linear_forecast_perfect_trend():
    historical = [2, 4, 6, 8, 10]
    result = linear_forecast(historical, horizon=3)
    assert abs(result["forecast"][0] - 12.0) < 0.5
    assert abs(result["forecast"][1] - 14.0) < 0.5
    assert abs(result["forecast"][2] - 16.0) < 0.5


def test_confidence_band_ordering():
    historical = [1, 3, 2, 5, 4, 6]
    result = linear_forecast(historical, horizon=3)
    for i in range(3):
        assert result["lower"][i] <= result["forecast"][i] <= result["upper"][i]


def test_forecast_slope_and_intercept():
    historical = [2, 4, 6, 8, 10]
    result = linear_forecast(historical, horizon=3)
    assert "slope" in result
    assert "intercept" in result
    assert abs(result["slope"] - 2.0) < 0.1
