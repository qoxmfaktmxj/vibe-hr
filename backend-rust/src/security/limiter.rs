use ring::digest;
use std::collections::VecDeque;

const WINDOW: i64 = 300;

#[derive(Default)]
struct Histories {
    // Ordered by access, oldest first. Saturated entries must survive admission.
    exact: VecDeque<(String, VecDeque<i64>)>,
    overflow: Vec<VecDeque<i64>>,
}

impl Histories {
    fn history(
        &mut self,
        key: &str,
        max_attempts: usize,
        max_keys: usize,
        now: i64,
    ) -> &mut VecDeque<i64> {
        self.exact.retain_mut(|(_, times)| {
            trim(times, now);
            !times.is_empty()
        });
        if let Some(position) = self.exact.iter().position(|(k, _)| k == key) {
            let existing = self.exact.remove(position).unwrap();
            self.exact.push_back(existing);
        } else {
            if self.exact.len() >= max_keys {
                if let Some(position) = self.exact.iter().position(|(_, h)| h.len() < max_attempts)
                {
                    self.exact.remove(position);
                } else {
                    if self.overflow.is_empty() {
                        self.overflow.resize_with(256, VecDeque::new);
                    }
                    // Spring uses the first four SHA256 bytes modulo 256.
                    let hash = digest::digest(&digest::SHA256, key.as_bytes());
                    let history = &mut self.overflow[usize::from(hash.as_ref()[3])];
                    trim(history, now);
                    return history;
                }
            }
            self.exact.push_back((key.to_owned(), VecDeque::new()));
        }
        &mut self.exact.back_mut().unwrap().1
    }
}

fn trim(times: &mut VecDeque<i64>, now: i64) {
    while times.front().is_some_and(|first| *first <= now - WINDOW) {
        times.pop_front();
    }
}

#[derive(Default)]
pub(super) struct LoginLimiter {
    clients: Histories,
    logins: Histories,
    sources: Histories,
}

impl LoginLimiter {
    pub(super) fn check(
        &mut self,
        client: &str,
        binding: &str,
        source: &str,
        now: i64,
        max_keys: usize,
    ) -> Result<(), i64> {
        let histories = [
            (self.clients.history(client, 30, max_keys, now), 30),
            (self.logins.history(binding, 10, max_keys, now), 10),
            (self.sources.history(source, 10, max_keys, now), 10),
        ];
        if let Some(wait) = histories
            .iter()
            .filter(|(h, limit)| h.len() >= *limit)
            .map(|(h, _)| (WINDOW - (now - h[0])).max(1))
            .max()
        {
            return Err(wait);
        }
        for (history, _) in histories {
            history.push_back(now);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn limits_client_login_and_source_independently_and_recovers() {
        for (dimension, limit) in [(0, 30), (1, 10), (2, 10)] {
            let mut limiter = LoginLimiter::default();
            for attempt in 0..=limit {
                let unique = attempt.to_string();
                let mut keys = [unique.as_str(); 3];
                keys[dimension] = "shared";
                let outcome = limiter.check(keys[0], keys[1], keys[2], 1000, 64);
                if attempt == limit {
                    assert_eq!(outcome, Err(300));
                    assert_eq!(limiter.check(keys[0], keys[1], keys[2], 1299, 64), Err(1));
                    assert_eq!(limiter.check(keys[0], keys[1], keys[2], 1300, 64), Ok(()));
                } else {
                    assert_eq!(outcome, Ok(()));
                }
            }
        }
    }
}
