package router

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"time"

	"github.com/hi-ai/gateway/internal/domain"
)

// ConditionalRule defines a single conditional routing rule.
type ConditionalRule struct {
	Priority   int
	Conditions MatchConditions
	Targets    []domain.RoutingTarget
}

// MatchConditions defines the supported matching conditions.
type MatchConditions struct {
	ModelPattern    string   // Regex pattern to match model name
	ProviderIDs     []string // Specified provider list
	MinContentLen   int      // Minimum input content length
	MaxContentLen   int      // Maximum input content length
	TimeWindowStart string   // Time window start (HH:MM format)
	TimeWindowEnd   string   // Time window end
}

// Conditional implements conditional routing based on rules.
type Conditional struct {
	rules          []ConditionalRule
	defaultTargets []domain.RoutingTarget
}

// NewConditional creates a new conditional router.
// Parses rules from MatchCriteria in the routing rule.
// Expected MatchCriteria structure: {"rules": [...], "default_targets": [...]}
func NewConditional(rule *domain.RoutingRule) *Conditional {
	c := &Conditional{
		defaultTargets: rule.Targets,
	}

	// Parse rules from MatchCriteria
	if criteria := rule.MatchCriteria; criteria != nil {
		if rulesRaw, ok := criteria["rules"]; ok {
			// Parse conditional rules list
			if rulesSlice, ok := rulesRaw.([]interface{}); ok {
				for _, r := range rulesSlice {
					if ruleMap, ok := r.(map[string]interface{}); ok {
						cr := parseConditionalRule(ruleMap)
						c.rules = append(c.rules, cr)
					}
				}
			}
		}
	}

	// Sort by Priority (lower value = higher priority)
	sort.Slice(c.rules, func(i, j int) bool {
		return c.rules[i].Priority < c.rules[j].Priority
	})

	return c
}

// Route selects targets based on conditional rules.
// Returns the targets of the first matching rule, or default targets if no match.
func (c *Conditional) Route(ctx context.Context, req *domain.RoutingRequest) ([]domain.RoutingTarget, error) {
	if len(c.rules) == 0 && len(c.defaultTargets) == 0 {
		return nil, fmt.Errorf("no rules or default targets configured for conditional routing")
	}

	// Iterate through rules, return targets of the first match
	for _, rule := range c.rules {
		if matchesConditions(rule.Conditions, req) {
			if len(rule.Targets) > 0 {
				return rule.Targets, nil
			}
		}
	}

	// No matching rule, return default targets
	if len(c.defaultTargets) > 0 {
		return c.defaultTargets, nil
	}

	return nil, fmt.Errorf("no matching conditional rule and no default targets")
}

// matchesConditions checks if the request matches all specified conditions.
func matchesConditions(cond MatchConditions, req *domain.RoutingRequest) bool {
	// Model name regex matching
	if cond.ModelPattern != "" {
		matched, err := regexp.MatchString(cond.ModelPattern, req.ModelID)
		if err != nil || !matched {
			return false
		}
	}

	// Provider list matching
	// Note: At routing stage, provider is not yet determined, so this condition
	// is used to filter targets by provider, not to check the request

	// Input content length check
	if cond.MinContentLen > 0 && req.ContentLength < cond.MinContentLen {
		return false
	}
	if cond.MaxContentLen > 0 && req.ContentLength > cond.MaxContentLen {
		return false
	}

	// Time window check
	if cond.TimeWindowStart != "" && cond.TimeWindowEnd != "" {
		now := time.Now()
		currentTime := now.Format("15:04")
		if !isInTimeWindow(currentTime, cond.TimeWindowStart, cond.TimeWindowEnd) {
			return false
		}
	}

	return true
}

// isInTimeWindow checks if the current time is within the specified time window.
// Supports windows that span midnight (e.g., 22:00 - 06:00).
func isInTimeWindow(current, start, end string) bool {
	if start <= end {
		return current >= start && current <= end
	}
	// Time window spanning midnight (e.g., 22:00 - 06:00)
	return current >= start || current <= end
}

// parseConditionalRule parses a single conditional rule from a map.
func parseConditionalRule(m map[string]interface{}) ConditionalRule {
	rule := ConditionalRule{}

	if p, ok := m["priority"].(float64); ok {
		rule.Priority = int(p)
	}

	// Parse conditions
	if condMap, ok := m["conditions"].(map[string]interface{}); ok {
		if mp, ok := condMap["model_pattern"].(string); ok {
			rule.Conditions.ModelPattern = mp
		}
		if pids, ok := condMap["provider_ids"].([]interface{}); ok {
			for _, pid := range pids {
				if s, ok := pid.(string); ok {
					rule.Conditions.ProviderIDs = append(rule.Conditions.ProviderIDs, s)
				}
			}
		}
		if ml, ok := condMap["min_content_length"].(float64); ok {
			rule.Conditions.MinContentLen = int(ml)
		}
		if ml, ok := condMap["max_content_length"].(float64); ok {
			rule.Conditions.MaxContentLen = int(ml)
		}
		if ts, ok := condMap["time_window_start"].(string); ok {
			rule.Conditions.TimeWindowStart = ts
		}
		if te, ok := condMap["time_window_end"].(string); ok {
			rule.Conditions.TimeWindowEnd = te
		}
	}

	// Parse targets
	if targetsRaw, ok := m["targets"].([]interface{}); ok {
		for _, t := range targetsRaw {
			if tm, ok := t.(map[string]interface{}); ok {
				target := domain.RoutingTarget{}
				if pid, ok := tm["provider_id"].(string); ok {
					target.ProviderID = pid
				}
				if mid, ok := tm["model_id"].(string); ok {
					target.ModelID = mid
				}
				if w, ok := tm["weight"].(float64); ok {
					target.Weight = int(w)
				}
				if p, ok := tm["priority"].(float64); ok {
					target.Priority = int(p)
				}
				rule.Targets = append(rule.Targets, target)
			}
		}
	}

	return rule
}
